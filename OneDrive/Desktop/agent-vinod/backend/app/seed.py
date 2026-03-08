"""Seed script - populates the database with sample data for demo/testing."""

import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import create_db_and_tables, engine
from app.models import (
    Workspace, Document, DocumentChunk, SandboxCredential,
    DemoRecipe, PolicyRule, DemoSession, SessionMessage,
)
from app.services.encryption import encrypt
from app.retrieval.ingest import ingest_document
from sqlmodel import Session


def seed():
    """Create sample workspace, documents, credentials, recipes, and policies."""
    create_db_and_tables()

    with Session(engine) as db:
        # Check if already seeded
        from sqlmodel import select
        existing = db.exec(select(Workspace)).first()
        if existing:
            print("Database already has data. Run 'make db-reset' to start fresh.")
            return

        print("Seeding database...")

        # 1. Create workspace
        workspace = Workspace(
            name="Acme CRM Pro",
            description="Demo workspace for Acme CRM Pro - a modern B2B customer relationship management platform",
            product_url="http://localhost:9090",
            allowed_domains="localhost,127.0.0.1",
            public_token="demo-acme-crm-001",
        )
        db.add(workspace)
        db.commit()
        db.refresh(workspace)
        print(f"  Created workspace: {workspace.name} (token: {workspace.public_token})")

        # 2. Upload documents
        docs_content = [
            {
                "filename": "product-overview.md",
                "file_type": "md",
                "content": """# Acme CRM Pro - Product Overview

Acme CRM Pro is a modern customer relationship management platform built for B2B sales teams.

## Key Features

### Dashboard
The main dashboard provides a real-time overview of your sales pipeline, including:
- Active deals and their stages
- Revenue forecasts
- Team performance metrics
- Recent activity feed

### Contact Management
Manage all your contacts and companies in one place:
- Create and edit contact records with custom fields
- Track communication history
- Link contacts to companies and deals
- Import/export contacts via CSV

### Deal Pipeline
Visual pipeline management for your sales process:
- Drag-and-drop deal cards between stages
- Custom pipeline stages
- Deal value tracking
- Win/loss analysis

### Reporting & Analytics
Comprehensive reporting suite:
- Sales performance dashboards
- Revenue by product, region, or rep
- Pipeline velocity metrics
- Custom report builder
- Export to PDF or CSV

### Search
Powerful global search across all records:
- Full-text search across contacts, companies, and deals
- Filter by type, date, owner, or custom fields
- Saved search queries
- Recent searches

### Integrations
Connect with your existing tools:
- Email (Gmail, Outlook)
- Calendar sync
- Slack notifications
- Zapier/webhook support
- REST API access
""",
            },
            {
                "filename": "feature-contacts.md",
                "file_type": "md",
                "content": """# Contact Management - Detailed Guide

## Creating a New Contact
1. Navigate to the Contacts page from the sidebar
2. Click the "New Contact" button in the top right
3. Fill in the required fields: First Name, Last Name, Email
4. Optionally add: Phone, Company, Title, Address
5. Add tags for segmentation
6. Click "Save Contact"

## Editing a Contact
1. Find the contact via search or browsing
2. Click on the contact name to open their profile
3. Click "Edit" button
4. Modify any fields
5. Click "Save Changes"

## Contact Custom Fields
Admins can add custom fields:
- Text, Number, Date, Dropdown, Multi-select
- Configure in Settings > Custom Fields > Contacts

## Communication Tracking
- All emails sent/received are logged automatically
- Manual notes and call logs can be added
- Activity timeline shows full interaction history
""",
            },
            {
                "filename": "feature-reporting.md",
                "file_type": "md",
                "content": """# Reporting & Analytics Guide

## Accessing Reports
Navigate to Analytics from the main sidebar menu.

## Built-in Reports
1. **Sales Overview** - Pipeline value, win rate, average deal size
2. **Revenue Forecast** - Projected revenue based on pipeline stage probabilities
3. **Team Performance** - Individual rep metrics and comparisons
4. **Activity Report** - Calls, emails, meetings logged per rep

## Custom Reports
1. Click "New Report"
2. Select data source (Contacts, Deals, Activities)
3. Choose metrics and dimensions
4. Apply filters
5. Select visualization type (chart, table, pivot)
6. Save and optionally schedule email delivery

## Dashboard Widgets
- Add report widgets to your dashboard
- Drag to rearrange
- Set auto-refresh intervals
""",
            },
        ]

        for doc_data in docs_content:
            doc = Document(
                workspace_id=workspace.id,
                filename=doc_data["filename"],
                file_type=doc_data["file_type"],
                content_text=doc_data["content"],
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)
            num_chunks = ingest_document(db, doc, content_override=doc_data["content"])
            print(f"  Ingested document: {doc.filename} ({num_chunks} chunks)")

        # 3. Add sandbox credentials (encrypted)
        creds = [
            {"label": "demo-user-1", "username": "demo@acmecrm.com", "password": "demo2024!"},
            {"label": "demo-user-2", "username": "demo2@acmecrm.com", "password": "demo2024!"},
        ]
        for cred_data in creds:
            cred = SandboxCredential(
                workspace_id=workspace.id,
                label=cred_data["label"],
                login_url="http://localhost:9090/login",
                username_encrypted=encrypt(cred_data["username"]),
                password_encrypted=encrypt(cred_data["password"]),
            )
            db.add(cred)
            print(f"  Added credential: {cred_data['label']}")
        db.commit()

        # 4. Create demo recipes
        recipes = [
            {
                "name": "Login and Navigate to Dashboard",
                "description": "Log into the CRM and show the main dashboard overview",
                "trigger_phrases": "dashboard,overview,main page,home,log in,start",
                "priority": 5,
                "steps": [
                    {"action": "narrate", "value": "Let me log in and show you the main dashboard.", "wait_ms": 500},
                    {"action": "navigate", "target": "http://localhost:9090/dashboard", "description": "Navigating to the dashboard", "wait_ms": 2000},
                    {"action": "screenshot", "description": "Here's the main dashboard view", "wait_ms": 1000},
                    {"action": "narrate", "value": "This is the main dashboard where you can see your sales pipeline, revenue forecasts, and team activity at a glance.", "wait_ms": 500},
                ],
            },
            {
                "name": "Search for a Record",
                "description": "Demonstrate the global search functionality",
                "trigger_phrases": "search,find,look up,locate,query",
                "priority": 4,
                "steps": [
                    {"action": "narrate", "value": "I'll show you how the search works.", "wait_ms": 500},
                    {"action": "navigate", "target": "http://localhost:9090/search", "description": "Opening the search page", "wait_ms": 1500},
                    {"action": "type", "target": "input[name='search']", "value": "Acme Corp", "description": "Searching for 'Acme Corp'", "wait_ms": 1500},
                    {"action": "screenshot", "description": "Here are the search results", "wait_ms": 1000},
                    {"action": "narrate", "value": "The search finds matches across contacts, companies, and deals. You can filter by type and date range.", "wait_ms": 500},
                ],
            },
            {
                "name": "Create a New Record",
                "description": "Walk through creating a new contact in the CRM",
                "trigger_phrases": "create,new,add,make,register,new contact,new record",
                "priority": 4,
                "steps": [
                    {"action": "narrate", "value": "Let me show you how to create a new contact.", "wait_ms": 500},
                    {"action": "navigate", "target": "http://localhost:9090/contacts/new", "description": "Opening the new contact form", "wait_ms": 1500},
                    {"action": "type", "target": "input[name='firstName']", "value": "Jane", "description": "Entering first name", "wait_ms": 800},
                    {"action": "type", "target": "input[name='lastName']", "value": "Smith", "description": "Entering last name", "wait_ms": 800},
                    {"action": "type", "target": "input[name='email']", "value": "jane.smith@example.com", "description": "Entering email", "wait_ms": 800},
                    {"action": "type", "target": "input[name='company']", "value": "TechStart Inc", "description": "Entering company name", "wait_ms": 800},
                    {"action": "screenshot", "description": "Here's the filled out form", "wait_ms": 1000},
                    {"action": "narrate", "value": "After filling in the details, you'd click Save to create the contact. The CRM supports custom fields too.", "wait_ms": 500},
                ],
            },
            {
                "name": "Edit an Existing Record",
                "description": "Show how to find and edit a contact record",
                "trigger_phrases": "edit,update,modify,change,existing record",
                "priority": 3,
                "steps": [
                    {"action": "narrate", "value": "I'll demonstrate editing an existing contact.", "wait_ms": 500},
                    {"action": "navigate", "target": "http://localhost:9090/contacts", "description": "Opening the contacts list", "wait_ms": 1500},
                    {"action": "screenshot", "description": "Here's the contacts list", "wait_ms": 1000},
                    {"action": "click", "target": ".contact-row:first-child", "description": "Opening the first contact", "wait_ms": 1500},
                    {"action": "click", "target": "button.edit-btn", "description": "Clicking edit", "wait_ms": 1000},
                    {"action": "screenshot", "description": "Now in edit mode - you can modify any field", "wait_ms": 1000},
                    {"action": "narrate", "value": "You can edit any field and the changes are saved immediately. There's also a full audit history of all changes.", "wait_ms": 500},
                ],
            },
            {
                "name": "Show Reporting and Analytics",
                "description": "Tour the analytics and reporting dashboard",
                "trigger_phrases": "report,analytics,metrics,data,insights,performance,numbers,statistics",
                "priority": 4,
                "steps": [
                    {"action": "narrate", "value": "Let me show you the reporting and analytics suite.", "wait_ms": 500},
                    {"action": "navigate", "target": "http://localhost:9090/analytics", "description": "Opening the analytics page", "wait_ms": 2000},
                    {"action": "screenshot", "description": "This is the analytics overview", "wait_ms": 1000},
                    {"action": "narrate", "value": "The analytics dashboard gives you real-time insights into your sales performance, pipeline velocity, and team metrics.", "wait_ms": 500},
                    {"action": "scroll", "value": "down", "description": "Scrolling to see more reports", "wait_ms": 1500},
                    {"action": "screenshot", "description": "More detailed reports are available below", "wait_ms": 1000},
                    {"action": "narrate", "value": "You can also build custom reports, schedule email delivery, and export to PDF or CSV.", "wait_ms": 500},
                ],
            },
        ]

        for recipe_data in recipes:
            recipe = DemoRecipe(
                workspace_id=workspace.id,
                name=recipe_data["name"],
                description=recipe_data["description"],
                trigger_phrases=recipe_data["trigger_phrases"],
                steps_json=json.dumps(recipe_data["steps"]),
                priority=recipe_data["priority"],
            )
            db.add(recipe)
            print(f"  Created recipe: {recipe.name}")
        db.commit()

        # 5. Create policy rules
        policies = [
            {
                "rule_type": "blocked_topic",
                "pattern": r"\b(competitor|salesforce|hubspot|pipedrive)\b",
                "description": "Competitor comparisons should be handled by sales team",
                "action": "escalate",
                "severity": "medium",
            },
            {
                "rule_type": "blocked_action",
                "pattern": r"\b(delete|remove|destroy|drop)\b.*\b(all|everything|database)\b",
                "description": "Bulk destructive actions are never allowed",
                "action": "refuse",
                "severity": "high",
            },
            {
                "rule_type": "escalation_condition",
                "pattern": r"\b(enterprise|custom plan|sla|volume discount|annual)\b",
                "description": "Enterprise and custom pricing discussions need sales rep",
                "action": "escalate",
                "severity": "medium",
            },
            {
                "rule_type": "blocked_route",
                "pattern": r"/admin|/settings/billing|/settings/security",
                "description": "Admin and billing pages are not part of the demo",
                "action": "refuse",
                "severity": "high",
            },
        ]

        for policy_data in policies:
            rule = PolicyRule(
                workspace_id=workspace.id,
                **policy_data,
            )
            db.add(rule)
            print(f"  Created policy: {policy_data['description']}")
        db.commit()

        print(f"\nSeed complete!")
        print(f"  Workspace ID: {workspace.id}")
        print(f"  Public token: {workspace.public_token}")
        print(f"  Demo link: http://localhost:3000/demo/{workspace.public_token}")
        print(f"  Admin link: http://localhost:3000/admin/workspaces/{workspace.id}")


if __name__ == "__main__":
    seed()
