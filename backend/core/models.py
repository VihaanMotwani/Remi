# --- SQLAlchemy ORM Base + Types ---
from sqlalchemy import (
    Column, String, Text, DateTime, Float, Boolean, ForeignKey,
    CheckConstraint, JSON, ARRAY
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

# --- Utility ---
from datetime import datetime
import uuid

# --- Project Base ---
from .base import Base



class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    description = Column(Text)
    stakeholders = Column(ARRAY(Text))
    priority = Column(Text, CheckConstraint("priority IN ('High', 'Medium', 'Low')"))
    status = Column(Text, CheckConstraint("status IN ('Active', 'Blocked', 'Completed')"))
    last_activity = Column(DateTime)
    ai_summary = Column(Text)
    context_vector = Column(Text)  # keep as TEXT if you don't want pgvector yet
    created_at = Column(DateTime, default=datetime.utcnow)


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    calendar_id = Column(Text)
    title = Column(Text, nullable=False)
    description = Column(Text)
    is_task = Column(Boolean, default=False)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    attendees = Column(ARRAY(Text))
    location = Column(Text)
    links = Column(ARRAY(Text))
    notes = Column(Text)
    action_items = Column(JSON)
    related_projects = Column(ARRAY(UUID(as_uuid=True)), ForeignKey("projects.id"))
    ai_summary = Column(Text)
    context_score = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)


class Email(Base):
    __tablename__ = "emails"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(Text, unique=True)
    thread_id = Column(Text)
    from_email = Column(Text)
    to_email = Column(ARRAY(Text))
    cc = Column(ARRAY(Text))
    subject = Column(Text)
    summary = Column(Text)
    action_items = Column(JSON)
    sentiment = Column(Text, CheckConstraint("sentiment IN ('positive', 'neutral', 'negative')"))
    category = Column(Text)
    importance_score = Column(Float)
    related_meetings = Column(ARRAY(UUID(as_uuid=True)), ForeignKey("events.id"))
    related_projects = Column(ARRAY(UUID(as_uuid=True)), ForeignKey("projects.id"))
    timestamp = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class MeetingNote(Base):
    __tablename__ = "meeting_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"))
    transcription = Column(Text)
    summary = Column(Text)
    notes = Column(Text)
    action_items = Column(JSON)
    related_emails = Column(ARRAY(UUID(as_uuid=True)), ForeignKey("emails.id"))
    related_projects = Column(ARRAY(UUID(as_uuid=True)), ForeignKey("projects.id"))
    sentiment_overall = Column(Text)
    ai_metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
