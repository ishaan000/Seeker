import os
from openai import OpenAI
from dotenv import load_dotenv
from agents.tools import tool_definitions, generate_sequence

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def chat_with_openai(messages: list, session_id: int) -> str:
    # Step 1: Send user + history messages and tool defs
    response = client.chat.completions.create(
        model="gpt-4",
        messages=messages,
        tools=tool_definitions,
        tool_choice="auto"
    )

    reply = response.choices[0].message

    # Step 2: If tool is called, extract name + arguments
    if reply.tool_calls:
        for tool_call in reply.tool_calls:
            if tool_call.function.name == "generate_sequence":
                args = tool_call.function.arguments
                import json
                parsed_args = json.loads(args)

                # Run the actual function
                result = generate_sequence(
                    role=parsed_args["role"],
                    location=parsed_args["location"],
                    tone=parsed_args["tone"],
                    session_id=session_id,
                    step_count=parsed_args.get("step_count") # Optional
                )

                # Step 3: Return tool result as if AI said it
                return result

    # Step 4: Otherwise, return plain text response
    return reply.content
