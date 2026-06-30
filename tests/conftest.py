import os
import sys

os.environ["STAGE"] = "dev"
os.environ["APP_URL"] = "http://localhost:3000"
os.environ["API_URL"] = "http://localhost:8000"

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
