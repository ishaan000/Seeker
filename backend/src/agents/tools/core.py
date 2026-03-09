from database.models import SequenceStep, db, Session
from openai import OpenAI
import os
from dotenv import load_dotenv
import json
import re
from typing import Dict, Any, Optional, List
from .web_search import search_professionals, get_professional_details, search_jobs, research_company, research_interview_prep, research_for_outreach

from socketio_instance import socketio  # import safely
import logging

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
logger = logging.getLogger(__name__)

def get_sequence_data(session_id: str):
    """Retrieve all steps of a sequence for a given session.
    
    This function fetches all sequence steps associated with a specific chat session,
    ordered by their step number.
    
    Args:
        session_id (str): The unique identifier of the chat session
        
    Returns:
        list: A list of dictionaries, where each dictionary contains:
            - step_number (int): The order of the step
            - content (str): The content of the step
            
    Note:
        Returns an empty list if no steps are found for the given session_id
    """
    steps = SequenceStep.query.filter_by(session_id=session_id).order_by(SequenceStep.step_number).all()
    return [{"step_number": step.step_number, "content": step.content} for step in steps]

def get_grouped_sequences(session_id: str) -> list:
    """Return all sequences for a session, grouped by sequence_group."""
    steps = SequenceStep.query.filter_by(session_id=session_id).order_by(SequenceStep.step_number).all()
    groups = {}
    for s in steps:
        group = s.sequence_group or "default"
        if group not in groups:
            groups[group] = {"title": s.sequence_title or "Outreach Sequence", "steps": []}
        groups[group]["steps"].append({"step_number": s.step_number, "content": s.content})
    return list(groups.values())


def emit_sequence_update(session_id: str):
    sequences = get_grouped_sequences(session_id)
    socketio.emit("sequence_updated", {"session_id": session_id, "sequences": sequences})

def validate_sequence_params(role: str, location: str) -> Optional[str]:
    """Validates the input parameters for sequence generation."""
    if not role or not location:
        return "Missing required parameters: role and location are required"
    if len(role) > 100 or len(location) > 100:
        return "Role and location exceed maximum length limits"
    return None

def generate_sequence(role: str, location: str, session_id: str, step_count: Optional[int] = None, profile_url: Optional[str] = None, company: Optional[str] = None, recipient_name: Optional[str] = None, personalization_notes: Optional[str] = None) -> str:
    print(f"\nGenerating sequence for role: {role}, location: {location}, session_id: {session_id}, company: {company}, recipient: {recipient_name}")

    validation_error = validate_sequence_params(role, location)
    if validation_error:
        return f"{validation_error}"

    # Get user info from session
    session = Session.query.get(session_id)
    user_name = session.user.name if session and session.user else "the job seeker"
    user_title = session.user.title if session and session.user else "professional"
    user = session.user if session else None

    # Build rich user context
    user_context = get_user_context(session_id)

    # --- Agentic Research Phase ---
    # 1. Research the company for outreach-relevant intel
    company_research = ""
    if company:
        print(f"Researching {company} for outreach context...")
        company_research = research_for_outreach(
            company=company,
            role=role,
            recipient_name=recipient_name
        )
        if company_research:
            print(f"Got {len(company_research)} chars of company research")

    # 2. Research the recipient if we have a profile URL
    professional_context = ""
    if profile_url:
        try:
            details = get_professional_details(profile_url)
            professional_context = f"""
RECIPIENT RESEARCH:
- Profile: {profile_url}
- Current Position: {details.get('title', 'N/A')}
- Background: {details.get('content', 'N/A')}
"""
        except Exception as e:
            logger.error(f"Error fetching professional details: {str(e)}")

    # 3. Build skills context
    skills_context = ""
    if user and user.preferences:
        prefs = user.preferences
        skills = prefs.get("skills", [])
        if skills:
            skills_context = f"Key skills: {', '.join(skills)}"
        years = prefs.get("yearsExperience", 0)
        if years:
            skills_context += f"\nYears of experience: {years}"

    # Build personalization section
    personalization_section = ""
    if personalization_notes:
        personalization_section = f"""--- USER'S PERSONAL CONTEXT (this is the MOST important input — make the sequence feel like it came from THIS person) ---
{personalization_notes}
"""

    base_prompt = f"""Write a 3-step outreach sequence from {user_name} ({user_title}) to {'the hiring manager' if not recipient_name else recipient_name} at {company or 'the target company'} for a {role} position in {location}.

{user_context}

{skills_context}

{personalization_section}

--- COMPANY RESEARCH (use specific details from this) ---
{company_research if company_research else 'No specific company research available. Write a strong general outreach.'}

{professional_context}

CRITICAL INSTRUCTIONS:
- The user's personal context above is your #1 priority. Weave their specific stories, projects, angles, and motivations into every message.
- Each message MUST reference at least one SPECIFIC detail from the company research above (a recent launch, funding round, blog post, product, initiative, etc.)
- Connect the user's personal context to the company's work — show WHY this person is reaching out to THIS company
- The first message should open with something that shows genuine knowledge — NOT "I came across your profile" or "I'm reaching out because"
- Weave in {user_name}'s specific skills ({skills_context}) and how they connect to what {company or 'the company'} is doing
- Each follow-up should add NEW value (a new insight, a different angle) — never just "checking in"
- Keep messages under 150 words each — busy people don't read long cold emails
- Sound human, not templated. No corporate buzzwords.

Respond ONLY with a JSON array:
[
  {{ "step_number": 1, "content": "..." }},
  {{ "step_number": 2, "content": "..." }},
  {{ "step_number": 3, "content": "..." }}
]"""

    if step_count:
        base_prompt = base_prompt.replace("3-step", f"{step_count}-step")

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": "You are an elite cold outreach strategist. You write messages that get responses because they demonstrate genuine research, specific relevance, and concise value. Never write generic outreach. Every sentence must earn its place."
                },
                {"role": "user", "content": base_prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )

        content = response.choices[0].message.content
        print("\nRaw GPT content:\n", content)

        try:
            # First try direct JSON parsing
            steps_json = json.loads(content)
        except json.JSONDecodeError:
            try:
                # Try to extract JSON array using regex
                json_str = re.search(r"\[.*\]", content, re.DOTALL)
                if not json_str:
                    return f"Could not find JSON array in response. Raw content:\n{content}"
                steps_json = json.loads(json_str.group())
                print("\n✅ Extracted JSON steps:\n", steps_json)
            except Exception as e:
                return f"Failed to parse sequence steps: {str(e)}\n\nRaw content:\n{content}"

        # Validate step structure
        if not isinstance(steps_json, list):
            return f"Expected JSON array, got {type(steps_json)}. Raw content:\n{content}"

        for step in steps_json:
            if not isinstance(step, dict):
                return f"Invalid step type: {type(step)}. Expected dict. Raw content:\n{content}"
            if "step_number" not in step or "content" not in step:
                return f"Missing required fields in step: {step}. Raw content:\n{content}"
            if not isinstance(step["step_number"], int):
                return f"Invalid step_number type: {type(step['step_number'])}. Expected int. Raw content:\n{content}"
            if not isinstance(step["content"], str):
                return f"Invalid content type: {type(step['content'])}. Expected str. Raw content:\n{content}"

        try:
            import uuid as _uuid
            group_id = str(_uuid.uuid4())

            # Build a smart title
            seq_title = f"Outreach to {company}" if company else f"Outreach - {role}"
            if recipient_name:
                seq_title = f"Outreach to {recipient_name}"

            # Add new steps in a new group (keep old sequences intact)
            for step in steps_json:
                new_step = SequenceStep(
                    session_id=session_id,
                    sequence_group=group_id,
                    sequence_title=seq_title,
                    step_number=step["step_number"],
                    content=step["content"].strip()
                )
                db.session.add(new_step)
                print(f"Adding step {step['step_number']} for session {session_id}, group {group_id}")

            db.session.commit()
            print(f"Successfully saved {len(steps_json)} steps for session {session_id}")

            emit_sequence_update(session_id)

            # Return a rich summary so the follow-up LLM can reference specifics
            target = recipient_name or f"the hiring manager at {company}" if company else "the target"
            summary = f"Generated a {len(steps_json)}-step outreach sequence to {target} for a {role} role."
            if company:
                summary += f" Company: {company}."
            if personalization_notes:
                summary += f" Personalized based on: {personalization_notes[:200]}"
            return summary

        except Exception as e:
            db.session.rollback()
            print(f"Database error while saving sequence: {str(e)}")
            return f"Error saving sequence to database: {str(e)}"

    except Exception as e:
        print(f"Error in generate_sequence: {str(e)}")
        return f"Error generating sequence: {str(e)}"

def get_user_context(session_id: str) -> str:
    session = Session.query.get(session_id)
    if not session or not session.user:
        return ""
    user = session.user
    
    # Extract job seeker preferences
    prefs = user.preferences or {}
    job_types = ", ".join(prefs.get("jobTypes", []) or ["Full-time"])
    target_companies = ", ".join(prefs.get("targetCompanies", []) or [])
    target_locations = ", ".join(prefs.get("targetLocations", []) or [])
    years_experience = prefs.get("yearsExperience", 0)
    skills = ", ".join(prefs.get("skills", []) or [])

    context = f"""
The messages should be written from {user.name}'s perspective as a {user.title} in the {user.industry} industry.
"""

    if user.company:
        context += f"Their current or previous company is {user.company}.\n"

    if years_experience:
        context += f"They have {years_experience} years of experience.\n"

    if skills:
        context += f"Their key skills include: {skills}.\n"

    if job_types:
        context += f"They are interested in {job_types} roles.\n"
    
    if target_locations:
        context += f"Their preferred locations are: {target_locations}.\n"
    
    if target_companies:
        context += f"Their target companies include: {target_companies}.\n"
    
    return context

def revise_step(session_id: str, step_number: int, new_instruction: str) -> str:
    # Target the most recent sequence group to avoid modifying the wrong sequence
    latest = SequenceStep.query.filter_by(session_id=session_id).order_by(SequenceStep.id.desc()).first()
    group_filter = {"session_id": session_id, "step_number": step_number}
    if latest and latest.sequence_group:
        group_filter["sequence_group"] = latest.sequence_group
    step = SequenceStep.query.filter_by(**group_filter).first()
    if not step:
        return f"Step {step_number} not found."

    user_context = get_user_context(session_id)
    prompt = f"""Rewrite this message to reflect the following instruction:
{user_context}
Instruction: {new_instruction}
Original message: {step.content}
Rewritten message:"""

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{ "role": "user", "content": prompt }],
        temperature=0.7
    )

    step.content = response.choices[0].message.content.strip()
    db.session.commit()
    emit_sequence_update(session_id)
    return f"Step {step_number} revised."

def change_tone(session_id: str, tone: str) -> str:
    # Target the most recent sequence group only
    latest = SequenceStep.query.filter_by(session_id=session_id).order_by(SequenceStep.id.desc()).first()
    if latest and latest.sequence_group:
        steps = SequenceStep.query.filter_by(session_id=session_id, sequence_group=latest.sequence_group).order_by(SequenceStep.step_number).all()
    else:
        steps = SequenceStep.query.filter_by(session_id=session_id).order_by(SequenceStep.step_number).all()
    if not steps:
        return "No steps found for this session."

    user_context = get_user_context(session_id)
    for step in steps:
        prompt = f"""Rewrite the following message to be more {tone}:
{user_context}
Original message: {step.content}
Rewritten message:"""
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{ "role": "user", "content": prompt }],
            temperature=0.7
        )
        step.content = response.choices[0].message.content.strip()

    db.session.commit()
    emit_sequence_update(session_id)
    return f"All steps updated to have a more {tone} tone."

def add_step(session_id: str, step_content: str, position: Optional[int] = None) -> str:
    # Target the most recent sequence group only
    latest = SequenceStep.query.filter_by(session_id=session_id).order_by(SequenceStep.id.desc()).first()
    if latest and latest.sequence_group:
        steps = SequenceStep.query.filter_by(session_id=session_id, sequence_group=latest.sequence_group).order_by(SequenceStep.step_number).all()
    else:
        steps = SequenceStep.query.filter_by(session_id=session_id).order_by(SequenceStep.step_number).all()

    if position is None or position > len(steps):
        position = len(steps) + 1

    # Get user context
    user_context = get_user_context(session_id)
    prompt = f"""Create a new message that matches the style and context of the existing sequence:
{user_context}
Original content: {step_content}
New message:"""

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{ "role": "user", "content": prompt }],
        temperature=0.7
    )

    new_content = response.choices[0].message.content.strip()

    # Shift step numbers at and after the insertion point
    for step in steps:
        if step.step_number >= position:
            step.step_number += 1

    # Add the new step (inherit sequence_group from existing steps)
    new_step = SequenceStep(
        session_id=session_id,
        step_number=position,
        content=new_content,
        sequence_group=latest.sequence_group if latest and latest.sequence_group else None,
        sequence_title=latest.sequence_title if latest else "Outreach Sequence"
    )
    db.session.add(new_step)

    # Reorder everything to ensure consistent step numbering
    all_steps = sorted(steps + [new_step], key=lambda s: s.step_number)
    for idx, step in enumerate(all_steps, start=1):
        step.step_number = idx

    db.session.commit()
    emit_sequence_update(session_id)
    return f"New step added at position {position}."

def generate_networking_asset(task: str, session_id: str):
    user_context = get_user_context(session_id)

    # Try to extract company name from the task for research
    company_research = ""
    # Simple extraction: look for "at [Company]" or "to [Company]" patterns
    import re as _re
    company_match = _re.search(r'(?:at|to|for|from)\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s+(?:for|about|regarding|as|in)|[,.]|$)', task)
    if company_match:
        extracted_company = company_match.group(1).strip()
        if len(extracted_company) > 2:
            print(f"Researching {extracted_company} for networking asset...")
            company_research = research_for_outreach(company=extracted_company)

    prompt = f"""You are an elite outreach writer. Write a message based on the task below.

{user_context}

Task: {task}

--- COMPANY RESEARCH (reference specific details from this) ---
{company_research if company_research else 'No specific research available.'}

RULES:
- Reference at least one SPECIFIC detail from the research above
- Sound human, not templated
- Keep it under 200 words
- Every sentence must earn its place
"""

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You write cold outreach messages that get responses because they show genuine research and specific relevance."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7
    )

    content = response.choices[0].message.content.strip()

    import uuid as _uuid
    group_id = str(_uuid.uuid4())

    # Derive title from the company match or task
    seq_title = f"Message - {extracted_company}" if company_match and extracted_company else task[:30]

    db.session.add(SequenceStep(
        session_id=session_id,
        sequence_group=group_id,
        sequence_title=seq_title,
        step_number=1,
        content=content
    ))
    db.session.commit()
    emit_sequence_update(session_id)

    return f"Generated: {seq_title}. Preview: {content[:150]}..."

def search_and_analyze_professionals(
    session_id: str,
    query: str,
    location: Optional[str] = None,
    years_experience: Optional[int] = None,
    skills: Optional[List[str]] = None,
    current_company: Optional[str] = None
) -> str:
    """
    Search for potential employers and networking contacts based on role and location.
    
    Args:
        session_id (str): The session ID
        query (str): Search query (e.g., "hiring managers", "engineering directors")
        location (Optional[str]): Location to search in
        years_experience (Optional[int]): Minimum years of experience
        skills (Optional[List[str]]): List of relevant skills
        current_company (Optional[str]): Target company name
    
    Returns:
        str: Formatted results with professional profiles
    """
    try:
        # Get user context for personalization
        user_context = get_user_context(session_id)
        
        # Search for professionals
        results = search_professionals(
            query=query,
            location=location,
            years_experience=years_experience,
            skills=skills,
            current_company=current_company,
            user_context=user_context
        )
        
        if not results["professionals"]:
            return f"I couldn't find any professionals matching your criteria for '{query}' in {location or 'any location'}. Would you like to try different search criteria?"
        
        # Format the results
        response = f"I found {results['total_found']} potential contacts matching your search for '{query}'"
        if location:
            response += f" in {location}"
        response += ":\n\n"
        
        for i, prof in enumerate(results["professionals"], 1):
            response += f"{i}. {prof['name']}\n"
            
            # Add current position if available
            if prof.get("current_position"):
                response += f"Current: {prof['current_position']}\n"
            
            # Add experience if available
            if "years_experience" in prof:
                response += f"Experience: {prof['years_experience']}+ years\n"
            
            # Add matched skills if available
            if "matched_skills" in prof and prof["matched_skills"]:
                response += f"Skills: {', '.join(prof['matched_skills'])}\n"
            
            # Add profile link
            response += f"Profile: {prof['link']}\n\n"

        return response
        
    except Exception as e:
        logger.error(f"Error in search_and_analyze_professionals: {str(e)}", exc_info=True)
        return f"An error occurred while searching for professionals: {str(e)}"

def generate_personalized_outreach(profile_url: str, session_id: str) -> str:
    """
    Generate a personalized outreach message for a specific professional based on their profile.
    
    Args:
        profile_url (str): URL of the professional's profile
        session_id (str): The current session ID
    
    Returns:
        str: A personalized outreach message
    """
    try:
        # Get professional details
        details = get_professional_details(profile_url)
        
        # Get user context
        session = Session.query.get(session_id)
        user_name = session.user.name if session and session.user else "the job seeker"
        user_title = session.user.title if session and session.user else "professional"
        
        # Generate personalized message using OpenAI
        prompt = f"""
        Generate a personalized outreach message for a professional based on their profile:
        Profile URL: {profile_url}
        Profile Content: {details['content']}
        
        The message should be from {user_name} as a {user_title} and should:
        1. Reference specific details from their profile
        2. Show genuine interest in their work
        3. Be concise but personal
        4. Include a clear value proposition
        
        Format the message in a professional but conversational tone.
        """
        
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an expert recruiter crafting personalized outreach messages."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=500
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        return f"An error occurred while generating the outreach message: {str(e)}"

def search_and_analyze_jobs(
    session_id: str,
    query: str,
    location: Optional[str] = None,
    job_type: Optional[str] = None
) -> str:
    """
    Search for job listings and format results for the user.

    Args:
        session_id (str): The session ID
        query (str): Job search query (e.g., "Senior Software Engineer")
        location (Optional[str]): Location to search in
        job_type (Optional[str]): Type of job (fulltime, parttime, contract, internship)

    Returns:
        str: Formatted job listings
    """
    try:
        user_context = get_user_context(session_id)
        results = search_jobs(
            query=query,
            location=location,
            job_type=job_type,
            user_context=user_context
        )

        if not results["jobs"]:
            return f"I couldn't find any job listings matching '{query}'" + (f" in {location}" if location else "") + ". Would you like to try different search criteria?"

        response = f"I found {results['total_found']} job listings matching '{query}'"
        if location:
            response += f" in {location}"
        response += ":\n\n"

        for i, job in enumerate(results["jobs"], 1):
            response += f"{i}. **{job['title']}**\n"
            response += f"   Company: {job['company']}\n"
            response += f"   Location: {job['location']}\n"
            if job.get("schedule"):
                response += f"   Type: {job['schedule']}\n"
            if job.get("posted"):
                response += f"   Posted: {job['posted']}\n"
            if job.get("description"):
                response += f"   {job['description']}\n"
            if job.get("link"):
                response += f"   Link: {job['link']}\n"
            response += "\n"

        return response

    except Exception as e:
        logger.error(f"Error in search_and_analyze_jobs: {str(e)}", exc_info=True)
        return f"An error occurred while searching for jobs: {str(e)}"


def _format_value(value) -> str:
    """Convert a value (str, list, dict) into a readable string."""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(f"- {item}" if isinstance(item, str) else f"- {json.dumps(item)}" for item in value)
    if isinstance(value, dict):
        return "\n".join(f"- {k}: {v}" for k, v in value.items())
    return str(value)


def research_company_tool(
    session_id: str,
    company: str,
    role: Optional[str] = None
) -> str:
    """
    Research a company and return formatted insights.
    """
    try:
        user_context = get_user_context(session_id)
        results = research_company(company=company, role=role, user_context=user_context)

        if not results["found"]:
            return f"I couldn't find detailed information about {company}. Would you like to try a different company?"

        insights = results["insights"]

        # If we got raw_content (parsing failed), try regex extraction as last resort
        if "raw_content" in insights:
            from .web_search import _extract_fields_regex
            extracted = _extract_fields_regex(insights["raw_content"])
            if extracted:
                insights = extracted
            else:
                return f"Here's what I found about {company}:\n\n{insights['raw_content']}"

        response = f"Here's what I found about {company}:\n\n"
        response += f"**Company Overview**\n{_format_value(insights.get('company_overview', 'No information available.'))}\n\n"
        response += f"**Funding & Financials**\n{_format_value(insights.get('funding_financials', 'No information available.'))}\n\n"
        response += f"**Recent News**\n{_format_value(insights.get('recent_news', 'No information available.'))}\n\n"
        response += f"**Company Culture**\n{_format_value(insights.get('company_culture', 'No information available.'))}\n\n"
        response += f"**Tech Stack**\n{_format_value(insights.get('tech_stack', 'No information available.'))}\n\n"
        response += f"**Employee Count**\n{_format_value(insights.get('employee_count', 'No information available.'))}\n\n"
        response += f"**Why Work Here**\n{_format_value(insights.get('why_work_here', 'No information available.'))}"

        return response

    except Exception as e:
        logger.error(f"Error in research_company_tool: {str(e)}", exc_info=True)
        return f"An error occurred while researching {company}: {str(e)}"


def prepare_for_interview_tool(
    session_id: str,
    company: str,
    role: Optional[str] = None
) -> str:
    """
    Prepare for an interview and return formatted prep material.
    """
    try:
        user_context = get_user_context(session_id)
        results = research_interview_prep(company=company, role=role, user_context=user_context)

        if not results["found"]:
            return f"I couldn't find interview preparation details for {company}. Would you like to try a different company?"

        prep = results["prep"]

        # If we got raw_content (parsing failed), try regex extraction as last resort
        if "raw_content" in prep:
            from .web_search import _extract_fields_regex
            extracted = _extract_fields_regex(prep["raw_content"])
            if extracted:
                prep = extracted
            else:
                return f"Here's your interview prep for {company}:\n\n{prep['raw_content']}"

        response = f"Here's your interview prep for {company}:\n\n"
        response += f"**Interview Process**\n{_format_value(prep.get('interview_process', 'No information available.'))}\n\n"
        response += f"**Common Questions**\n{_format_value(prep.get('common_questions', 'No information available.'))}\n\n"
        response += f"**What They Look For**\n{_format_value(prep.get('what_they_look_for', 'No information available.'))}\n\n"
        response += f"**Tips for Success**\n{_format_value(prep.get('tips_for_success', 'No information available.'))}\n\n"
        response += f"**Compensation Range**\n{_format_value(prep.get('compensation_range', 'No information available.'))}"

        return response

    except Exception as e:
        logger.error(f"Error in prepare_for_interview_tool: {str(e)}", exc_info=True)
        return f"An error occurred while preparing interview materials for {company}: {str(e)}"


tool_definitions = [
    {
        "type": "function",
        "function": {
            "name": "generate_sequence",
            "description": "Generates a deeply researched, personalized outreach sequence. Automatically researches the target company for recent news, launches, and intel to make messages stand out. Use this for multi-step outreach campaigns.",
            "parameters": {
                "type": "object",
                "properties": {
                    "role": {"type": "string", "description": "The role the user is interested in (e.g., 'Software Engineer', 'Product Manager')"},
                    "location": {"type": "string", "description": "Where the job is based (e.g., 'San Francisco', 'Remote')"},
                    "company": {"type": "string", "description": "The target company name (e.g., 'Google', 'Stripe'). Will be auto-researched for personalization."},
                    "recipient_name": {"type": "string", "description": "Optional. Name of the person to address the outreach to"},
                    "step_count": {"type": "integer", "description": "Optional. Number of outreach steps (default 3)"},
                    "session_id": {"type": "string", "description": "The session ID as a string UUID"},
                    "profile_url": {"type": "string", "description": "Optional. LinkedIn URL of the recipient for deeper personalization"},
                    "personalization_notes": {"type": "string", "description": "The user's answers to follow-up questions — their personal angle, specific projects, motivations, prior interactions with the company, etc. This is critical for making the outreach feel personal and specific."}
                },
                "required": ["role", "location", "session_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "revise_step",
            "description": "Revises the content of a specific step using an instruction",
            "parameters": {
                "type": "object",
                "properties": {
                    "step_number": {"type": "integer", "description": "Step number to revise"},
                    "new_instruction": {"type": "string", "description": "How to revise this step"},
                    "session_id": {"type": "string", "description": "The session ID as a string UUID"}
                },
                "required": ["step_number", "new_instruction", "session_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "change_tone",
            "description": "Changes the tone of the entire sequence (e.g. casual, personal, professional)",
            "parameters": {
                "type": "object",
                "properties": {
                    "tone": {"type": "string", "description": "Tone to apply (e.g. personal, bold, casual)"},
                    "session_id": {"type": "string", "description": "The session ID as a string UUID"}
                },
                "required": ["tone", "session_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_step",
            "description": "Adds a new step to the outreach sequence",
            "parameters": {
                "type": "object",
                "properties": {
                    "step_content": {"type": "string", "description": "Content of the new step"},
                    "position": {"type": "integer", "description": "Position to insert the step"},
                    "session_id": {"type": "string", "description": "The session ID as a string UUID"}
                },
                "required": ["step_content", "session_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_networking_asset",
            "description": "Creates a single job search-related message (application email, thank you note, follow-up, etc) from a task description",
            "parameters": {
                "type": "object",
                "properties": {
                    "task": {"type": "string", "description": "Instruction like 'Write a thank you email after the interview with Google'"},
                    "session_id": {"type": "string", "description": "The session ID as a string UUID"}
                },
                "required": ["task", "session_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_and_analyze_professionals",
            "description": "Searches for potential employers and networking contacts based on role and location",
            "parameters": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID as a string UUID"},
                    "query": {"type": "string", "description": "The search query (e.g., 'hiring managers', 'engineering directors')"},
                    "location": {"type": "string", "description": "Optional. Location to search in (e.g., 'San Francisco')"},
                    "years_experience": {"type": "integer", "description": "Optional. Minimum years of experience"},
                    "skills": {"type": "array", "items": {"type": "string"}, "description": "Optional. List of relevant skills"},
                    "current_company": {"type": "string", "description": "Optional. Target company name"}
                },
                "required": ["session_id", "query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_jobs",
            "description": "Searches for job listings matching the user's criteria",
            "parameters": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID as a string UUID"},
                    "query": {"type": "string", "description": "The job search query (e.g., 'Senior Software Engineer', 'Product Manager')"},
                    "location": {"type": "string", "description": "Optional. Location to search in (e.g., 'San Francisco, CA')"},
                    "job_type": {"type": "string", "description": "Optional. Type of job: fulltime, parttime, contract, internship"}
                },
                "required": ["session_id", "query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_personalized_outreach",
            "description": "Generates a personalized outreach message for a specific professional based on their profile",
            "parameters": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID as a string UUID"},
                    "profile_url": {"type": "string", "description": "The URL of the professional's profile"}
                },
                "required": ["session_id", "profile_url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "research_company",
            "description": "Researches a company in depth - overview, funding, culture, tech stack, recent news, and reasons to work there",
            "parameters": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID as a string UUID"},
                    "company": {"type": "string", "description": "The company name to research (e.g., 'Google', 'Stripe')"},
                    "role": {"type": "string", "description": "Optional. The role the user is interested in at this company"}
                },
                "required": ["session_id", "company"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "prepare_for_interview",
            "description": "Prepares interview materials for a specific company - interview process, common questions, tips, and compensation ranges",
            "parameters": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID as a string UUID"},
                    "company": {"type": "string", "description": "The company name to prepare for (e.g., 'Google', 'Meta')"},
                    "role": {"type": "string", "description": "Optional. The specific role to prepare for"}
                },
                "required": ["session_id", "company"]
            }
        }
    }
]