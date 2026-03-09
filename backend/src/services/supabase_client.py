from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

def sign_up(email: str, password: str):
    """Sign up a new user with Supabase auth."""
    try:
        response = supabase.auth.sign_up({
            "email": email,
            "password": password
        })
        return response
    except Exception as e:
        raise Exception(f"Error signing up: {str(e)}")

def sign_in(email: str, password: str):
    """Sign in a user with Supabase auth."""
    try:
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        return response
    except Exception as e:
        raise Exception(f"Error signing in: {str(e)}")

def get_user(token: str):
    """Get user information from Supabase auth token."""
    try:
        response = supabase.auth.get_user(token)
        return response
    except Exception as e:
        raise Exception(f"Error getting user: {str(e)}")

def check_email_verification(email: str):
    """Check if a user's email has been verified."""
    try:
        # Get the user's auth state
        response = supabase.auth.get_user_by_email(email)
        return response.user.email_confirmed_at is not None
    except Exception as e:
        raise Exception(f"Error checking email verification: {str(e)}") 