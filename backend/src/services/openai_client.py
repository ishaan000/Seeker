import os
from openai import OpenAI
from dotenv import load_dotenv
from agents.tools import (
    tool_definitions,
    generate_sequence,
    revise_step,
    change_tone,
    add_step,
    generate_networking_asset,
    search_and_analyze_professionals,
    generate_personalized_outreach,
    search_and_analyze_jobs,
    research_company_tool,
    prepare_for_interview_tool
)
from agents.tools.core import get_grouped_sequences
from database.models import SequenceStep, Session
import json


load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def chat_with_openai(messages: list, session_id: str) -> dict:
    print(f"\nProcessing chat with session_id: {session_id}")  # Debug log

    # Fetch the user context via the session ID
    session = Session.query.get(session_id)
    if session and session.user:
        user = session.user
        context_message = {
            "role": "system",
            "content": f"""
    The user is a job seeker named {user.name} with experience as a {user.title} in the {user.industry} industry.
    Their company background is {user.company}.
    Do NOT ask for this information again unless explicitly requested.
    """
        }
        # Inject into the second position (after the main system prompt, before chat history)
        messages.insert(1, context_message)
        
    # Step 1: Send user + history messages and tool defs
    response = client.chat.completions.create(
        model="gpt-4",
        messages=messages,
        tools=tool_definitions,
        tool_choice="auto"
    )

    message = response.choices[0].message
    # Step 2: If tool is called, extract name + arguments
    if message.tool_calls:
        for tool_call in message.tool_calls:
            name = tool_call.function.name
            args = json.loads(tool_call.function.arguments)
            
            # Always use the correct session_id from the chat endpoint
            args["session_id"] = session_id
            
            print(f"→ Tool called: {name}")
            print(f"→ Arguments: {json.dumps(args, indent=2)}")

            try:
                if name == "generate_sequence":
                    result = generate_sequence(**args)
                elif name == "revise_step":
                    result = revise_step(**args)
                elif name == "change_tone":
                    result = change_tone(**args)
                elif name == "add_step":
                    result = add_step(**args)
                elif name == "generate_networking_asset":
                    result = generate_networking_asset(**args)
                elif name == "search_and_analyze_professionals":
                    result = search_and_analyze_professionals(**args)
                elif name == "generate_personalized_outreach":
                    result = generate_personalized_outreach(**args)
                elif name == "search_jobs":
                    result = search_and_analyze_jobs(**args)
                elif name == "research_company":
                    result = research_company_tool(**args)
                elif name == "prepare_for_interview":
                    result = prepare_for_interview_tool(**args)

                print(f"Tool execution result: {result}")  # Debug log
            except Exception as e:
                print(f"Error executing tool {name}: {str(e)}")  # Debug log
                continue

        follow_up_system = """You are Seeker, an AI job search assistant. You just completed an action for the user.

Your response MUST have exactly two parts:
1. A SHORT follow-up (1-2 sentences max) — reference specific details from the results
2. Exactly 3 numbered suggestions in the format below — NEVER skip these

RULES:
- Sound like a smart friend helping with their job search, not a robot.
- Do NOT repeat or summarize results that are already displayed.
- Reference SPECIFIC names, companies, roles from the conversation and results.
- GOOD follow-ups:
  - "Your 3-step sequence to Piotr leads with their Comet browser launch — should stand out."
  - "Found 4 people at ElevenLabs you could reach out to."
- BAD follow-ups (NEVER say these):
  - "Great work on generating the outreach sequence."
  - "Are you ready for the next steps?"
  - "Here's how we might proceed."

You MUST end your response with exactly this format (no exceptions):

Would you like to:
1. [specific actionable suggestion with real names/companies]
2. [specific actionable suggestion with real names/companies]
3. [specific actionable suggestion with real names/companies]

Pick from these actions (use real names from results):
- Research [Company] - funding, culture, and recent news
- Prep me for an interview at [Company] for a [Role] role
- Find hiring managers at [Company]
- Find [Role] jobs in [Location]
- Write an outreach sequence to [Person Name] at [Company]
- Revise step [N] to be more [specific change]
- Change the tone to [casual/bold/formal]
"""

        # Build recent conversation context for the follow-up LLM
        # Include last few user/assistant messages so it has conversational awareness
        recent_context = ""
        user_messages_in_history = [m for m in messages if m.get("role") == "user"]
        if user_messages_in_history:
            last_user_msg = user_messages_in_history[-1]["content"]
            recent_context = f"User's request: {last_user_msg}\n\n"

        # For sequence generation, include a snippet of what was generated
        result_context = result[:2000]
        if name in ("generate_sequence", "generate_networking_asset"):
            # Fetch the most recently created group's steps so the follow-up can reference actual content
            latest_step = SequenceStep.query.filter_by(session_id=session_id).order_by(SequenceStep.id.desc()).first()
            if latest_step and latest_step.sequence_group:
                new_steps = SequenceStep.query.filter_by(
                    session_id=session_id, sequence_group=latest_step.sequence_group
                ).order_by(SequenceStep.step_number).all()
                if new_steps:
                    step_previews = []
                    for s in new_steps:
                        preview = s.content[:150] + "..." if len(s.content) > 150 else s.content
                        step_previews.append(f"Step {s.step_number}: {preview}")
                    result_context = result + "\n\nSequence preview:\n" + "\n".join(step_previews)

        # Step 3: Send follow-up with conversation context + results
        follow_up_response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": follow_up_system},
                {"role": "user", "content": f"{recent_context}Tool used: {name}\n\nResults:\n{result_context}"}
            ]
        )

        # Build grouped sequences
        sequences_data = get_grouped_sequences(session_id)

        # If this was a search, include the search results in the response
        if name in ("search_and_analyze_professionals", "search_jobs", "research_company", "prepare_for_interview"):
            return {
                "response": result + "\n\n" + follow_up_response.choices[0].message.content,
                "sequences": sequences_data
            }

        return {
            "response": follow_up_response.choices[0].message.content,
            "sequences": sequences_data
        }

    return {"response": message.content}