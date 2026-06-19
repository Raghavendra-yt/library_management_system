"""
Library Management System - Flask REST API Backend
===================================================
Application factory & entry point.

This module creates the Flask app, initializes extensions, registers
all route blueprints, and sets up the database. The monolithic logic
has been decomposed into:

  - config.py      → Configuration & constants
  - models.py      → SQLAlchemy ORM models
  - utils.py       → Pure helper functions
  - database.py    → DB initialization, migration & seeding
  - routes/        → Blueprint-based route handlers
  - services/      → Business logic layer

Run:  python app.py
"""

import os

from flask import Flask
from flask_cors import CORS

from config import Config, BASE_DIR
from models import db
from database import init_database
from routes import register_routes


# ---------------------------------------------------------------------------
# Application Factory
# ---------------------------------------------------------------------------

def create_app() -> Flask:
    """Create and configure the Flask application.

    Returns:
        A fully configured Flask application instance with all
        extensions initialized, blueprints registered, and database ready.
    """
    app = Flask(
        __name__,
        static_folder=Config.STATIC_FOLDER,
        static_url_path=Config.STATIC_URL_PATH,
    )
    app.config.from_object(Config)

    # ── Extensions ────────────────────────────────────────────────────────
    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # ── Route Blueprints ──────────────────────────────────────────────────
    register_routes(app)

    # ── Database (create tables, migrate, seed) ───────────────────────────
    init_database(app, BASE_DIR)

    # ── SPA Catch-All Route ───────────────────────────────────────────────
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        """Serve the React frontend for any non-API route."""
        if path != "" and os.path.exists(
            os.path.join(app.static_folder, path)
        ):
            return app.send_static_file(path)
        else:
            return app.send_static_file("index.html")

    return app


# ---------------------------------------------------------------------------
# Entry Point (for local development only)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app = create_app()
    print("\n[*] Library Management API running at http://127.0.0.1:5000")
    print("   CORS enabled for all origins on /api/* routes.\n")
    app.run(debug=True, host="0.0.0.0", port=5000)
