import unittest
from unittest.mock import patch
from app import create_app
from database.db import db
from database.models import Message, SequenceStep

class ChatEndpointTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(testing=True)
        self.client = self.app.test_client()

        with self.app.app_context():
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.drop_all()

    
    def test_tool_call_and_sequence_generation(self):
            session_id = 99
            message = "Generate a 3-step outreach sequence for a Product Manager in SF with a professional tone"

            res = self.client.post("/chat", json={"message": message, "session_id": session_id})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertIn("response", data)

            with self.app.app_context():
                steps = SequenceStep.query.filter_by(session_id=session_id).all()
                self.assertEqual(len(steps), 3)
                for step in steps:
                    self.assertIsNotNone(step.content)

if __name__ == "__main__":
    unittest.main()
