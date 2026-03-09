from typing import Dict, List, Optional
import os
from dotenv import load_dotenv
from openai import OpenAI
import logging
import json
import re

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

perplexity_client = OpenAI(
    api_key=os.getenv("PERPLEXITY_API_KEY"),
    base_url="https://api.perplexity.ai"
)


def _parse_json_array(content: str) -> list:
    """Parse a JSON array from LLM response content, with regex fallback."""
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\[.*\]", content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                return []
        return []


def _extract_json_object(content: str) -> str:
    """Extract a top-level JSON object from content using bracket matching."""
    start = content.find("{")
    if start == -1:
        return ""
    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(content)):
        c = content[i]
        if escape:
            escape = False
            continue
        if c == "\\":
            escape = True
            continue
        if c == '"' and not escape:
            in_string = not in_string
            continue
        if in_string:
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return content[start:i + 1]
    return ""


def _repair_json(text: str) -> str:
    """Try to fix common LLM JSON issues: unclosed arrays/strings, trailing commas."""
    # Remove control characters
    text = re.sub(r'[\x00-\x1f\x7f]', ' ', text)
    # Remove trailing commas before } or ]
    text = re.sub(r',\s*([}\]])', r'\1', text)
    # Fix unclosed arrays: "value"} -> "value"]}
    # Count unmatched [ and ] outside strings
    fixed = list(text)
    in_str = False
    esc = False
    bracket_depth = 0
    brace_depth = 0
    last_bracket_pos = -1
    for i, c in enumerate(fixed):
        if esc:
            esc = False
            continue
        if c == '\\' and in_str:
            esc = True
            continue
        if c == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if c == '[':
            bracket_depth += 1
            last_bracket_pos = i
        elif c == ']':
            bracket_depth -= 1
        elif c == '{':
            brace_depth += 1
        elif c == '}':
            # If there are unclosed arrays, close them before this brace
            if bracket_depth > 0:
                fixed[i] = ']' * bracket_depth + '}'
                bracket_depth = 0
            brace_depth -= 1
    return ''.join(fixed)


def _parse_json_object(content: str) -> dict:
    """Parse a JSON object from LLM response content, with robust fallback."""
    # Try direct parse first
    try:
        return json.loads(content)
    except (json.JSONDecodeError, TypeError):
        pass

    # Try bracket-matched extraction
    extracted = _extract_json_object(content)
    if extracted:
        try:
            return json.loads(extracted)
        except json.JSONDecodeError:
            pass
        # Try repairing common LLM JSON issues
        repaired = _repair_json(extracted)
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

    # Try repairing the full content
    repaired_full = _repair_json(content)
    extracted2 = _extract_json_object(repaired_full)
    if extracted2:
        try:
            return json.loads(extracted2)
        except json.JSONDecodeError:
            pass

    # Last resort: try regex extraction of individual field values
    result = _extract_fields_regex(content)
    if result:
        return result

    logger.warning("Could not parse JSON object from LLM response, returning raw content")
    return {"raw_content": content}


def _extract_fields_regex(content: str) -> Optional[dict]:
    """Extract JSON field values using regex when full parsing fails."""
    fields = [
        "company_overview", "funding_financials", "recent_news",
        "company_culture", "tech_stack", "employee_count", "why_work_here",
        "interview_process", "common_questions", "what_they_look_for",
        "tips_for_success", "compensation_range"
    ]
    result = {}
    for field in fields:
        # Match "field": "string value" or "field": [array]
        # String value
        str_pattern = rf'"{field}"\s*:\s*"((?:[^"\\]|\\.)*)"'
        str_match = re.search(str_pattern, content, re.DOTALL)
        if str_match:
            result[field] = str_match.group(1).replace('\\"', '"').replace('\\n', '\n')
            continue
        # Array value — find opening [ and match to closing ]
        arr_pattern = rf'"{field}"\s*:\s*\['
        arr_match = re.search(arr_pattern, content)
        if arr_match:
            start = arr_match.end() - 1  # include the [
            depth = 0
            end = start
            for i in range(start, len(content)):
                if content[i] == '[':
                    depth += 1
                elif content[i] == ']':
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            else:
                # Unclosed array — close it
                end = len(content)
                arr_str = content[start:end].rstrip().rstrip(',') + ']'
                try:
                    result[field] = json.loads(arr_str)
                except json.JSONDecodeError:
                    # Extract quoted strings from the partial array
                    items = re.findall(r'"((?:[^"\\]|\\.)*)"', arr_str)
                    if items:
                        result[field] = items
                continue
            try:
                result[field] = json.loads(content[start:end])
            except json.JSONDecodeError:
                items = re.findall(r'"((?:[^"\\]|\\.)*)"', content[start:end])
                if items:
                    result[field] = items

    return result if result else None


def search_professionals(
    query: str,
    location: Optional[str] = None,
    years_experience: Optional[int] = None,
    skills: Optional[List[str]] = None,
    current_company: Optional[str] = None,
    user_context: Optional[str] = None
) -> Dict:
    """
    Search for potential employers and networking contacts using LinkedIn via Perplexity Sonar.
    """
    try:
        prompt = f"Find LinkedIn profiles of people matching: {query}"
        if location:
            prompt += f" in {location}"
        if current_company:
            prompt += f" at {current_company}"
        if years_experience:
            prompt += f" with {years_experience}+ years experience"
        if skills:
            prompt += f" skilled in {', '.join(skills)}"

        system_prompt = """You are a professional search assistant. Find real LinkedIn profiles matching the query.
Return a JSON array of objects with these fields:
- name: full name
- current_position: their current job title and company
- linkedin_url: their LinkedIn profile URL
- snippet: a brief summary of their background

Return ONLY the JSON array, no other text."""

        if user_context:
            system_prompt += f"""

User context for personalization:
{user_context}
Use this context to exclude results from the user's own current company and prioritize relevant contacts."""

        logger.info(f"Searching professionals via Perplexity: {query}")
        response = perplexity_client.chat.completions.create(
            model="sonar",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            extra_body={
                "search_domain_filter": ["linkedin.com"],
                "return_citations": True,
                "web_search_options": {"search_context_size": "high"}
            }
        )

        content = response.choices[0].message.content
        professionals_raw = _parse_json_array(content)

        professionals = []
        for p in professionals_raw:
            professionals.append({
                "name": p.get("name", ""),
                "link": p.get("linkedin_url", ""),
                "snippet": p.get("snippet", ""),
                "source": "LinkedIn",
                "type": "profile",
                "current_position": p.get("current_position", "")
            })

        return {
            "query": query,
            "professionals": professionals,
            "total_found": len(professionals)
        }

    except Exception as e:
        logger.error(f"Error in search_professionals: {str(e)}", exc_info=True)
        return {
            "query": query,
            "professionals": [],
            "total_found": 0
        }


def search_jobs(
    query: str,
    location: Optional[str] = None,
    job_type: Optional[str] = None,
    user_context: Optional[str] = None
) -> Dict:
    """
    Search for job listings using Perplexity Sonar Pro.
    Searches company career pages, ATS boards, and job platforms for real postings.
    """
    try:
        prompt = f"Find real, currently open job listings for: {query}"
        if location:
            prompt += f" in {location}"
        if job_type:
            prompt += f" ({job_type})"

        system_prompt = """You are an expert job search assistant. Find real, currently open job postings.

IMPORTANT SEARCH PRIORITIES:
1. Direct company career pages and ATS boards (jobs.lever.co, boards.greenhouse.io, careers.*, jobs.*)
2. LinkedIn job postings with direct apply links
3. Other job boards as supplementary sources

For each job, find the DIRECT application link — not an aggregator page. Prefer links from greenhouse.io, lever.co, ashbyhq.com, workday.com, or the company's own careers page.

Return a JSON array of objects with these fields:
- title: exact job title as posted
- company: company name
- location: job location (include "Remote" or "Hybrid" if applicable)
- description: brief job description highlighting key requirements (max 200 chars)
- link: direct URL to the job posting (prefer company career page or ATS link)
- posted: when it was posted (e.g. "2 days ago", "1 week ago")
- schedule: job type (e.g. "Full-time", "Contract", "Remote")

Return ONLY the JSON array, no other text."""

        if user_context:
            system_prompt += f"""

User context for personalization:
{user_context}
Use this context to exclude jobs at the user's current company and prioritize their target companies and preferences. If they have target companies, actively search those companies' career pages."""

        logger.info(f"Searching jobs via Perplexity: {query}")
        response = perplexity_client.chat.completions.create(
            model="sonar-pro",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            extra_body={
                "search_recency_filter": "month",
                "return_citations": True,
                "web_search_options": {"search_context_size": "high"}
            }
        )

        content = response.choices[0].message.content
        jobs_raw = _parse_json_array(content)

        jobs = []
        for j in jobs_raw[:10]:
            jobs.append({
                "title": j.get("title", ""),
                "company": j.get("company", ""),
                "location": j.get("location", ""),
                "description": j.get("description", "")[:200],
                "link": j.get("link", ""),
                "posted": j.get("posted", ""),
                "schedule": j.get("schedule", ""),
            })

        return {
            "query": query,
            "jobs": jobs,
            "total_found": len(jobs)
        }

    except Exception as e:
        logger.error(f"Error in search_jobs: {str(e)}", exc_info=True)
        return {
            "query": query,
            "jobs": [],
            "total_found": 0
        }


def research_company(
    company: str,
    role: Optional[str] = None,
    user_context: Optional[str] = None
) -> Dict:
    """
    Deep company research via Perplexity sonar-pro.
    """
    try:
        prompt = f"Research the company {company} for a job seeker."
        if role:
            prompt += f" They are interested in a {role} role."

        system_prompt = """You are a company research assistant for job seekers. Research the given company thoroughly.
Return a JSON object with these fields:
- company_overview: A paragraph about what the company does, its mission, and market position
- funding_financials: Funding rounds, valuation, revenue info if available
- recent_news: 2-3 recent news items or developments
- company_culture: Work culture, values, employee satisfaction
- tech_stack: Technologies and tools used (if tech company)
- employee_count: Approximate number of employees and growth
- why_work_here: 2-3 compelling reasons to work at this company

Return ONLY the JSON object, no other text."""

        if user_context:
            system_prompt += f"\n\nUser context for personalization:\n{user_context}"

        logger.info(f"Researching company via Perplexity: {company}")
        response = perplexity_client.chat.completions.create(
            model="sonar-pro",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            extra_body={
                "search_domain_filter": ["crunchbase.com", "techcrunch.com", "bloomberg.com"],
                "return_citations": True,
                "web_search_options": {"search_context_size": "high"}
            }
        )

        content = response.choices[0].message.content
        insights = _parse_json_object(content)

        return {
            "company": company,
            "insights": insights,
            "found": bool(insights)
        }

    except Exception as e:
        logger.error(f"Error in research_company: {str(e)}", exc_info=True)
        return {
            "company": company,
            "insights": {},
            "found": False
        }


def research_interview_prep(
    company: str,
    role: Optional[str] = None,
    user_context: Optional[str] = None
) -> Dict:
    """
    Interview preparation research via Perplexity sonar-pro.
    """
    try:
        prompt = f"Help me prepare for an interview at {company}."
        if role:
            prompt += f" The role is {role}."

        system_prompt = """You are an interview preparation assistant. Research the company's interview process thoroughly.
Return a JSON object with these fields:
- interview_process: Step-by-step breakdown of their interview process
- common_questions: 5-7 commonly asked interview questions at this company
- what_they_look_for: Key traits, skills, and qualities they value in candidates
- tips_for_success: 3-5 actionable tips for acing the interview
- compensation_range: Salary range and benefits information if available

Return ONLY the JSON object, no other text."""

        if user_context:
            system_prompt += f"\n\nUser context for personalization:\n{user_context}"

        logger.info(f"Researching interview prep via Perplexity: {company}")
        response = perplexity_client.chat.completions.create(
            model="sonar-pro",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            extra_body={
                "search_domain_filter": ["glassdoor.com", "leetcode.com", "levels.fyi"],
                "return_citations": True,
                "web_search_options": {"search_context_size": "high"}
            }
        )

        content = response.choices[0].message.content
        prep = _parse_json_object(content)

        return {
            "company": company,
            "role": role or "General",
            "prep": prep,
            "found": bool(prep)
        }

    except Exception as e:
        logger.error(f"Error in research_interview_prep: {str(e)}", exc_info=True)
        return {
            "company": company,
            "role": role or "General",
            "prep": {},
            "found": False
        }


def research_for_outreach(
    company: str,
    role: Optional[str] = None,
    recipient_name: Optional[str] = None
) -> str:
    """
    Focused research for writing standout outreach messages.
    Returns a plain text briefing (not JSON) with recent, specific intel.
    """
    try:
        prompt = f"I'm about to write a cold outreach message to someone at {company}."
        if recipient_name:
            prompt += f" The recipient is {recipient_name}."
        if role:
            prompt += f" I'm interested in a {role} role."
        prompt += " Give me specific, recent things I can reference to make my message stand out."

        system_prompt = f"""You are a research assistant helping someone write a standout cold outreach message to someone at {company}.

Find SPECIFIC, RECENT, and CONCRETE details — the kind of things that show the sender actually did their homework. Focus on:

1. **Recent launches or product updates** (last 3-6 months) — new features, products, or pivots
2. **Recent funding, acquisitions, or partnerships** — with specific numbers and dates
3. **Company blog posts or engineering blog highlights** — specific technical challenges they've written about
4. **Team or leadership changes** — new hires, promotions, team growth areas
5. **Open challenges or initiatives** — what problems they're actively solving
6. **Culture signals** — specific company values, traditions, or unique perks that are real (not generic)

Be SPECIFIC. Not "they recently launched a product" but "they launched Claude 3.5 Sonnet in June 2024 with a focus on coding performance."

Return a concise briefing (not JSON), organized by bullet points. Only include things that are factual and verifiable."""

        response = perplexity_client.chat.completions.create(
            model="sonar-pro",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            extra_body={
                "return_citations": True,
                "search_recency_filter": "month",
                "web_search_options": {"search_context_size": "high"}
            }
        )

        return response.choices[0].message.content

    except Exception as e:
        logger.error(f"Error in research_for_outreach: {str(e)}", exc_info=True)
        return ""


def get_professional_details(profile_url: str) -> Dict:
    """
    Get detailed information about a professional from their profile URL.
    """
    try:
        logger.info(f"Fetching professional details via Perplexity: {profile_url}")
        response = perplexity_client.chat.completions.create(
            model="sonar",
            messages=[
                {
                    "role": "system",
                    "content": "You are a research assistant. Summarize the professional background of the person at the given URL. Include their current role, company, experience, and notable achievements."
                },
                {
                    "role": "user",
                    "content": f"Summarize the professional at this profile: {profile_url}"
                }
            ],
            extra_body={
                "return_citations": True,
                "web_search_options": {"search_context_size": "high"}
            }
        )

        content = response.choices[0].message.content
        return {
            "url": profile_url,
            "content": content,
            "title": content.split("\n")[0] if content else ""
        }

    except Exception as e:
        logger.error(f"Error in get_professional_details: {str(e)}", exc_info=True)
        return {
            "url": profile_url,
            "content": "",
            "title": ""
        }
