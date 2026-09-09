"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
from secrets import compare_digest

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

with (current_dir / "teachers.json").open(encoding="utf-8") as teachers_file:
    teachers = json.load(teachers_file)["teachers"]

SESSION_COOKIE = "teacher_session"
SESSION_SECRET = os.getenv("SESSION_SECRET", "development-session-secret")


class LoginRequest(BaseModel):
    username: str
    password: str


def require_teacher(request: Request) -> str:
    username = get_teacher_from_cookie(request)
    if not username:
        raise HTTPException(status_code=401, detail="Teacher login required")
    return username


def create_session_token(username: str) -> str:
    encoded_username = base64.urlsafe_b64encode(username.encode()).decode()
    signature = hmac.new(
        SESSION_SECRET.encode(), encoded_username.encode(), hashlib.sha256
    ).hexdigest()
    return f"{encoded_username}.{signature}"


def get_teacher_from_cookie(request: Request) -> str | None:
    token = request.cookies.get(SESSION_COOKIE, "")
    try:
        encoded_username, signature = token.split(".", 1)
        expected_signature = hmac.new(
            SESSION_SECRET.encode(), encoded_username.encode(), hashlib.sha256
        ).hexdigest()
        if not compare_digest(signature, expected_signature):
            return None
        return base64.urlsafe_b64decode(encoded_username).decode()
    except (ValueError, UnicodeDecodeError, base64.binascii.Error):
        return None

# In-memory activity database
activities = {
    "Chess Club": {
        "category": "Academic",
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "category": "Academic",
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "category": "Sports",
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "category": "Sports",
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "category": "Sports",
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "category": "Arts",
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "category": "Arts",
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "category": "Academic",
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "category": "Academic",
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.get("/auth/me")
def get_current_user(request: Request):
    username = get_teacher_from_cookie(request)
    return {"authenticated": bool(username), "username": username}


@app.post("/auth/login")
def login(login_request: LoginRequest, request: Request):
    for teacher in teachers:
        if (compare_digest(teacher["username"], login_request.username)
                and compare_digest(teacher["password"], login_request.password)):
            response = JSONResponse({
                "message": "Logged in successfully",
                "username": teacher["username"],
            })
            response.set_cookie(
                SESSION_COOKIE,
                create_session_token(teacher["username"]),
                httponly=True,
                samesite="lax",
                secure=os.getenv("HTTPS_ONLY", "false").lower() == "true",
            )
            return response

    raise HTTPException(status_code=401, detail="Invalid username or password")


@app.post("/auth/logout")
def logout():
    response = JSONResponse({"message": "Logged out successfully"})
    response.delete_cookie(SESSION_COOKIE)
    return response


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str, _: str = Depends(require_teacher)):
    """Sign up a student for an activity"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, _: str = Depends(require_teacher)):
    """Unregister a student from an activity"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
