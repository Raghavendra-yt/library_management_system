"""
Library Management System - Flask REST API Backend
===================================================
A decoupled REST API backend using Flask, Flask-SQLAlchemy, and Flask-CORS.
Database: SQLite3 (zero-setup, file-based)
Run: python app.py
"""

import os
from datetime import date, datetime, timedelta
from decimal import Decimal

# pyrefly: ignore [missing-import]
from flask import Flask, jsonify, request
from flask_cors import CORS
# pyrefly: ignore [missing-import]
from flask_sqlalchemy import SQLAlchemy

# ---------------------------------------------------------------------------
# Application Factory & Configuration
# ---------------------------------------------------------------------------

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Determine static folder path (for built React frontend in '../dist')
dist_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "dist"))
app = Flask(__name__, static_folder=dist_dir, static_url_path="/")

# ── Database ──────────────────────────────────────────────────────────────
app.config["SQLALCHEMY_DATABASE_URI"] = (
    "sqlite:///" + os.path.join(BASE_DIR, "library.db")
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# ── CORS: allow any origin so the Antigravity frontend never hits policy errors
CORS(app, resources={r"/api/*": {"origins": "*"}})

db = SQLAlchemy(app)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FINE_PER_DAY = 10.0  # ₹10 fine charged per overdue day


# ---------------------------------------------------------------------------
# SQLAlchemy Models
# ---------------------------------------------------------------------------

class Student(db.Model):
    """
    Represents a library member (student).
    Primary key: student_id (user-defined string like 'ST-1234').
    """
    __tablename__ = "students"

    student_id  = db.Column(db.String(20), primary_key=True)
    first_name  = db.Column(db.String(80), nullable=False)
    last_name   = db.Column(db.String(80), nullable=False)
    email       = db.Column(db.String(120), unique=True, nullable=False)
    phone       = db.Column(db.String(20))
    department  = db.Column(db.String(100))
    class_year  = db.Column(db.String(20))
    status      = db.Column(
        db.String(20), nullable=False, default="Active"
    )  # 'Active' | 'Graduated' | 'Suspended'

    # Relationship: a student can have many transactions
    transactions = db.relationship(
        "Transaction",
        backref="student",
        cascade="all, delete-orphan",
        lazy=True,
    )

    def to_dict(self):
        return {
            "student_id":  self.student_id,
            "first_name":  self.first_name,
            "last_name":   self.last_name,
            "full_name":   f"{self.first_name} {self.last_name}",
            "email":       self.email,
            "phone":       self.phone,
            "department":  self.department,
            "class_year":  self.class_year,
            "status":      self.status,
        }


class Book(db.Model):
    """
    Represents a book title in the library catalog.
    available_copies tracks real-time availability.
    book_image stores a URL or base64 data URI for the cover image.
    """
    __tablename__ = "books"

    book_id          = db.Column(db.Integer, primary_key=True, autoincrement=True)
    isbn             = db.Column(db.String(20), unique=True, nullable=False)
    title            = db.Column(db.String(200), nullable=False)
    author           = db.Column(db.String(120), nullable=False)
    total_copies     = db.Column(db.Integer, nullable=False, default=1)
    available_copies = db.Column(db.Integer, nullable=False, default=1)
    category         = db.Column(db.String(80))
    book_image       = db.Column(db.Text, nullable=True)   # cover URL or base64 data URI

    # Relationship: a book can appear in many transactions
    transactions = db.relationship(
        "Transaction",
        backref="book",
        cascade="all, delete-orphan",
        lazy=True,
    )

    def to_dict(self):
        return {
            "book_id":          self.book_id,
            "isbn":             self.isbn,
            "title":            self.title,
            "author":           self.author,
            "total_copies":     self.total_copies,
            "available_copies": self.available_copies,
            "category":         self.category,
            "book_image":       self.book_image,
        }


class Transaction(db.Model):
    """
    Represents a book loan event (issue → return lifecycle).
    status: 'Active' | 'Returned' | 'Lost'
    """
    __tablename__ = "transactions"

    transaction_id = db.Column(db.String(20), primary_key=True)
    book_id        = db.Column(db.Integer, db.ForeignKey("books.book_id"),       nullable=False)
    student_id     = db.Column(db.String(20), db.ForeignKey("students.student_id"), nullable=False)
    issue_date     = db.Column(db.Date, nullable=False, default=date.today)
    due_date       = db.Column(db.Date, nullable=False)
    return_date    = db.Column(db.Date, nullable=True)
    status         = db.Column(db.String(20), nullable=False, default="Active")
    # 'Active' | 'Returned' | 'Lost'

    # Relationship: a transaction can have at most one fine record
    fine = db.relationship(
        "Fine",
        backref="transaction",
        cascade="all, delete-orphan",
        uselist=False,
        lazy=True,
    )

    def to_dict(self):
      return {
          "transaction_id": self.transaction_id,
          "book_id":        self.book_id,
          "student_id":     self.student_id,
          "issue_date":     str(self.issue_date),
          "due_date":       str(self.due_date),
          "return_date":    str(self.return_date) if self.return_date else None,
          "status":         self.status,
      }


class Fine(db.Model):
    """
    Tracks fines generated from overdue or lost book transactions.
    payment_status: 'Pending' | 'Paid'
    """
    __tablename__ = "fines"

    fine_id        = db.Column(db.Integer, primary_key=True, autoincrement=True)
    transaction_id = db.Column(
        db.String(20), db.ForeignKey("transactions.transaction_id"), nullable=False, unique=True
    )
    fine_amount    = db.Column(db.Float, nullable=False, default=0.0)
    payment_status = db.Column(db.String(20), nullable=False, default="Pending")
    # 'Pending' | 'Paid'
    paid_date      = db.Column(db.Date, nullable=True)

    def to_dict(self):
        return {
            "fine_id":        self.fine_id,
            "transaction_id": self.transaction_id,
            "fine_amount":    self.fine_amount,
            "payment_status": self.payment_status,
            "paid_date":      str(self.paid_date) if self.paid_date else None,
        }


# ---------------------------------------------------------------------------
# Helper Utilities
# ---------------------------------------------------------------------------

def success_response(data, status_code=200):
    """Wrap data in a standard success envelope."""
    return jsonify({"status": "success", "data": data}), status_code


def error_response(message, status_code=400):
    """Wrap an error message in a standard error envelope."""
    return jsonify({"status": "error", "message": message}), status_code


def calculate_fine(due_date, return_date=None):
    """
    Calculate fine amount based on days overdue.
    Uses today's date if the book has not yet been returned.
    """
    check_date = return_date if return_date else date.today()
    if check_date > due_date:
        overdue_days = (check_date - due_date).days
        return round(overdue_days * FINE_PER_DAY, 2)
    return 0.0


# ---------------------------------------------------------------------------
# Routes – Dashboard
# ---------------------------------------------------------------------------

@app.route("/api/v1/dashboard/metrics", methods=["GET"])
def dashboard_metrics():
    """
    GET /api/v1/dashboard/metrics
    Returns aggregated KPI figures for the dashboard header cards:
      - Total Books Volume  (sum of all total_copies)
      - Active Book Loans   (transactions with status='Active')
      - Overdue Returns     (active transactions past their due_date)
      - Total Pending Fines (sum of all unpaid fine amounts)
    """
    today = date.today()

    total_books = db.session.query(
        db.func.coalesce(db.func.sum(Book.total_copies), 0)
    ).scalar()

    active_loans = Transaction.query.filter_by(status="Active").count()

    overdue_count = Transaction.query.filter(
        Transaction.status == "Active",
        Transaction.due_date < today,
    ).count()

    total_fines = db.session.query(
        db.func.coalesce(db.func.sum(Fine.fine_amount), 0)
    ).filter(Fine.payment_status == "Pending").scalar()

    return success_response({
        "totalBooks":   int(total_books),
        "activeIssues": active_loans,
        "totalOverdue": overdue_count,
        "totalFines":   round(float(total_fines), 2),
    })


@app.route("/api/v1/dashboard/overdue", methods=["GET"])
def dashboard_overdue():
    """
    GET /api/v1/dashboard/overdue
    Returns a joined list of all currently overdue loans enriched with:
      - student name, student_id
      - book title
      - issue_date, expected_return_date (due_date)
      - days_overdue
      - fine_amount (current accrued fine, 0 if none recorded yet)
      - automated_reminder_sent (always False for now; extend as needed)
    Ordered by most overdue first.
    """
    today = date.today()

    overdue_txns = (
        Transaction.query
        .filter(Transaction.status == "Active", Transaction.due_date < today)
        .join(Book,    Transaction.book_id    == Book.book_id)
        .join(Student, Transaction.student_id == Student.student_id)
        .order_by(Transaction.due_date.asc())
        .all()
    )

    result = []
    for txn in overdue_txns:
        days_overdue = (today - txn.due_date).days
        fine_amount  = txn.fine.fine_amount if txn.fine else calculate_fine(txn.due_date)
        s = txn.student
        b = txn.book

        result.append({
            # ── Transaction ──────────────────────────────────────
            "transaction_id":          txn.transaction_id,
            "issue_date":              str(txn.issue_date),
            "expected_return_date":    str(txn.due_date),
            "days_overdue":            days_overdue,
            "fine_amount":             fine_amount,
            "fine_status":             txn.fine.payment_status if txn.fine else "Pending",
            "automated_reminder_sent": 0,
            # ── Student ───────────────────────────────────────────
            "student_id":    s.student_id,
            "student_name":  f"{s.first_name} {s.last_name}",
            "first_name":    s.first_name,
            "last_name":     s.last_name,
            "email":         s.email,
            "phone":         s.phone,
            "department":    s.department,
            "class_year":    s.class_year,
            "student_status": s.status,
            # ── Book ──────────────────────────────────────────────
            "book_id":       b.book_id,
            "title":         b.title,
            "author":        b.author,
            "isbn":          b.isbn,
            "category":      b.category,
        })

    return success_response(result)


# ---------------------------------------------------------------------------
# Routes – Books
# ---------------------------------------------------------------------------

@app.route("/api/v1/books", methods=["GET"])
def get_books():
    """
    GET /api/v1/books?search=<query>&category=<category>
    Returns the full book catalog, optionally filtered.
    """
    search   = request.args.get("search",   "").strip().lower()
    category = request.args.get("category", "").strip()

    query = Book.query
    if search:
        query = query.filter(
            db.or_(
                Book.title.ilike(f"%{search}%"),
                Book.author.ilike(f"%{search}%"),
                Book.isbn.ilike(f"%{search}%"),
            )
        )
    if category:
        query = query.filter(Book.category == category)

    books = query.order_by(Book.title).all()
    return success_response([b.to_dict() for b in books])


@app.route("/api/v1/books", methods=["POST"])
def add_book():
    """
    POST /api/v1/books
    Body: { isbn, title, author, total_copies, category, book_image? }
    Registers a new book in the catalog.
    """
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be valid JSON.")

    required = ["isbn", "title", "author", "total_copies"]
    missing  = [f for f in required if not payload.get(f)]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}")

    if Book.query.filter_by(isbn=payload["isbn"]).first():
        return error_response("A book with this ISBN already exists.", 409)

    copies = int(payload["total_copies"])
    book   = Book(
        isbn             = payload["isbn"],
        title            = payload["title"],
        author           = payload["author"],
        total_copies     = copies,
        available_copies = copies,
        category         = payload.get("category", "General"),
        book_image       = payload.get("book_image"),
    )
    db.session.add(book)
    db.session.commit()
    return success_response(book.to_dict(), 201)


@app.route("/api/v1/books/<int:book_id>", methods=["PUT"])
def update_book(book_id):
    """
    PUT /api/v1/books/<book_id>
    Updates book metadata. Does not modify available_copies directly.
    """
    book = Book.query.get_or_404(book_id)
    payload = request.get_json(silent=True) or {}

    for field in ["isbn", "title", "author", "category", "book_image"]:
        if field in payload:
            setattr(book, field, payload[field])

    if "total_copies" in payload:
        delta = int(payload["total_copies"]) - book.total_copies
        book.total_copies      = int(payload["total_copies"])
        book.available_copies  = max(0, book.available_copies + delta)

    db.session.commit()
    return success_response(book.to_dict())


@app.route("/api/v1/books/<int:book_id>", methods=["DELETE"])
def delete_book(book_id):
    """
    DELETE /api/v1/books/<book_id>
    Removes a book from the catalog (cascades to transactions & fines).
    """
    book = Book.query.get_or_404(book_id)
    db.session.delete(book)
    db.session.commit()
    return success_response({"deleted_book_id": book_id})


# ---------------------------------------------------------------------------
# Routes – Students
# ---------------------------------------------------------------------------

@app.route("/api/v1/students", methods=["GET"])
def get_students():
    """
    GET /api/v1/students?search=<query>
    Returns the full student directory, optionally filtered.
    """
    search = request.args.get("search", "").strip().lower()
    query  = Student.query
    if search:
        query = query.filter(
            db.or_(
                Student.first_name.ilike(f"%{search}%"),
                Student.last_name.ilike(f"%{search}%"),
                Student.student_id.ilike(f"%{search}%"),
                Student.email.ilike(f"%{search}%"),
            )
        )
    students = query.order_by(Student.last_name).all()
    return success_response([s.to_dict() for s in students])


@app.route("/api/v1/students", methods=["POST"])
def add_student():
    """
    POST /api/v1/students
    Body: { student_id, first_name, last_name, email, phone?, department?, class_year?, status? }
    """
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be valid JSON.")

    required = ["student_id", "first_name", "last_name", "email"]
    missing  = [f for f in required if not payload.get(f)]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}")

    if Student.query.get(payload["student_id"]):
        return error_response("Student ID already exists.", 409)

    student = Student(
        student_id = payload["student_id"],
        first_name = payload["first_name"],
        last_name  = payload["last_name"],
        email      = payload["email"],
        phone      = payload.get("phone", ""),
        department = payload.get("department", ""),
        class_year = payload.get("class_year", ""),
        status     = payload.get("status", "Active"),
    )
    db.session.add(student)
    db.session.commit()
    return success_response(student.to_dict(), 201)


@app.route("/api/v1/students/<student_id>", methods=["DELETE"])
def delete_student(student_id):
    """
    DELETE /api/v1/students/<student_id>
    Removes a student record (cascades to transactions & fines).
    """
    student = Student.query.get_or_404(student_id)
    db.session.delete(student)
    db.session.commit()
    return success_response({"deleted_student_id": student_id})


@app.route("/api/v1/students/<student_id>", methods=["PUT"])
def update_student(student_id):
    """
    PUT /api/v1/students/<student_id>
    Updates a student record.
    """
    student = Student.query.get_or_404(student_id)
    payload = request.get_json(silent=True) or {}

    if "first_name" in payload:
        student.first_name = payload["first_name"]
    if "last_name" in payload:
        student.last_name = payload["last_name"]
    if "email" in payload:
        email = payload["email"]
        if email != student.email:
            existing = Student.query.filter_by(email=email).first()
            if existing:
                return error_response("A student with this email already exists.", 409)
        student.email = email
    if "phone" in payload:
        student.phone = payload["phone"]
    if "department" in payload:
        student.department = payload["department"]
    if "class_year" in payload:
        student.class_year = payload["class_year"]
    if "status" in payload:
        student.status = payload["status"]

    db.session.commit()
    return success_response(student.to_dict())


@app.route("/api/v1/students/<student_id>/transactions", methods=["GET"])
def get_student_transactions(student_id):
    """
    GET /api/v1/students/<student_id>/transactions
    Returns all transactions for a specific student, enriched with book info.
    Used to populate "Currently Borrowed" and "Recent History" in the student detail view.
    """
    student = Student.query.get_or_404(student_id)
    txns = (
        Transaction.query
        .filter_by(student_id=student_id)
        .join(Book, Transaction.book_id == Book.book_id)
        .order_by(Transaction.issue_date.desc())
        .all()
    )
    today = date.today()
    result = []
    for txn in txns:
        item = txn.to_dict()
        item["book_title"]   = txn.book.title
        item["book_author"]  = txn.book.author
        item["student_name"] = f"{student.first_name} {student.last_name}"
        item["fine_amount"]  = txn.fine.fine_amount if txn.fine else 0.0
        item["fine_id"]      = txn.fine.fine_id if txn.fine else None
        item["fine_status"]  = txn.fine.payment_status if txn.fine else None
        item["is_overdue"]   = (
            txn.status == "Active" and txn.due_date < today
        )
        item["days_overdue"] = (
            (today - txn.due_date).days if item["is_overdue"] else 0
        )
        result.append(item)
    return success_response(result)


@app.route("/api/v1/students/<student_id>/fines", methods=["GET"])
def get_student_fines(student_id):
    """
    GET /api/v1/students/<student_id>/fines?status=Pending|Paid
    Returns all fine records for a specific student.
    """
    Student.query.get_or_404(student_id)
    status_filter = request.args.get("status", "").strip()

    query = (
        Fine.query
        .join(Transaction, Fine.transaction_id == Transaction.transaction_id)
        .filter(Transaction.student_id == student_id)
    )
    if status_filter:
        query = query.filter(Fine.payment_status == status_filter)

    fines = query.order_by(Fine.fine_id.desc()).all()
    result = []
    for fine in fines:
        item = fine.to_dict()
        item["book_title"] = fine.transaction.book.title
        item["due_date"]   = str(fine.transaction.due_date)
        result.append(item)
    return success_response(result)


@app.route("/api/v1/students/<student_id>/stats", methods=["GET"])
def get_student_stats(student_id):
    """
    GET /api/v1/students/<student_id>/stats
    Returns aggregate statistics for a specific student:
      - total_checked_out : lifetime transaction count
      - active_loans      : currently active/non-returned loans
      - late_returns      : count of transactions returned after due_date
      - overdue_count     : currently overdue active loans
      - total_fines_paid  : sum of paid fines
      - total_fines_pending: sum of pending fines
    """
    Student.query.get_or_404(student_id)
    today = date.today()

    all_txns = Transaction.query.filter_by(student_id=student_id).all()
    total_checked_out = len(all_txns)
    active_loans      = sum(1 for t in all_txns if t.status == "Active")
    overdue_count     = sum(1 for t in all_txns if t.status == "Active" and t.due_date < today)
    late_returns      = sum(
        1 for t in all_txns
        if t.status == "Returned" and t.return_date and t.return_date > t.due_date
    )

    paid_fines = db.session.query(
        db.func.coalesce(db.func.sum(Fine.fine_amount), 0)
    ).join(Transaction).filter(
        Transaction.student_id == student_id,
        Fine.payment_status == "Paid"
    ).scalar()

    pending_fines = db.session.query(
        db.func.coalesce(db.func.sum(Fine.fine_amount), 0)
    ).join(Transaction).filter(
        Transaction.student_id == student_id,
        Fine.payment_status == "Pending"
    ).scalar()

    return success_response({
        "total_checked_out":    total_checked_out,
        "active_loans":         active_loans,
        "overdue_count":        overdue_count,
        "late_returns":         late_returns,
        "total_fines_paid":     round(float(paid_fines), 2),
        "total_fines_pending":  round(float(pending_fines), 2),
    })


# ---------------------------------------------------------------------------
# Routes – Transactions
# ---------------------------------------------------------------------------

@app.route("/api/v1/transactions", methods=["GET"])
def get_transactions():
    """
    GET /api/v1/transactions?status=<Active|Returned|Lost>
    Returns transactions enriched with student name and book title.
    """
    status_filter = request.args.get("status", "").strip()
    query = Transaction.query.join(Book).join(Student)

    if status_filter:
        query = query.filter(Transaction.status == status_filter)

    txns = query.order_by(Transaction.issue_date.desc()).all()

    result = []
    for txn in txns:
        item = txn.to_dict()
        item["student_name"] = f"{txn.student.first_name} {txn.student.last_name}"
        item["book_title"]   = txn.book.title
        item["fine_amount"]  = txn.fine.fine_amount if txn.fine else 0.0
        result.append(item)

    return success_response(result)


@app.route("/api/v1/transactions/checkout", methods=["POST"])
def checkout_book():
    """
    POST /api/v1/transactions/checkout
    Body: { student_id, book_id, due_date (YYYY-MM-DD, optional) }

    Creates a new active transaction and decrements available_copies.
    Default loan period is 14 days if due_date is not provided.
    """
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be valid JSON.")

    required = ["student_id", "book_id"]
    missing  = [f for f in required if not payload.get(f)]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}")

    # Validate student
    student = Student.query.get(payload["student_id"])
    if not student:
        return error_response("Student not found.", 404)
    if student.status == "Suspended":
        return error_response("Student account is suspended. Cannot issue books.")

    # Validate book
    book = Book.query.get(payload["book_id"])
    if not book:
        return error_response("Book not found.", 404)
    if book.available_copies < 1:
        return error_response("No copies of this book are currently available.")

    # Determine due date (default: 14-day loan period)
    if payload.get("due_date"):
        try:
            due_date = datetime.strptime(payload["due_date"], "%Y-%m-%d").date()
        except ValueError:
            return error_response("Invalid due_date format. Use YYYY-MM-DD.")
    else:
        due_date = date.today() + timedelta(days=14)

    # Create transaction
    last_txn = Transaction.query.order_by(Transaction.transaction_id.desc()).first()
    if last_txn:
        try:
            last_id_num = int(last_txn.transaction_id.split("-")[1])
            next_id_num = last_id_num + 1
        except (IndexError, ValueError):
            next_id_num = Transaction.query.count() + 1
    else:
        next_id_num = 1
    new_tx_id = f"TRX-{next_id_num:04d}"

    txn = Transaction(
        transaction_id = new_tx_id,
        book_id    = book.book_id,
        student_id = student.student_id,
        issue_date = date.today(),
        due_date   = due_date,
        status     = "Active",
    )
    db.session.add(txn)

    # Decrement available copies
    book.available_copies -= 1

    db.session.commit()

    response_data = txn.to_dict()
    response_data["student_name"] = f"{student.first_name} {student.last_name}"
    response_data["book_title"]   = book.title
    response_data["fine_amount"]  = 0.0

    return success_response(response_data, 201)


@app.route("/api/v1/transactions/return/<transaction_id>", methods=["POST"])
def return_book(transaction_id):
    """
    POST /api/v1/transactions/return/<transaction_id>

    Marks a transaction as 'Returned', increments available_copies,
    and automatically calculates and records any overdue fine.

    Returns:
      - updated transaction details
      - fine_amount (0 if returned on time)
      - days_overdue
    """
    txn = Transaction.query.get_or_404(transaction_id)

    if txn.status == "Returned":
        return error_response("This transaction has already been marked as returned.", 409)

    return_date  = date.today()
    txn.return_date = return_date
    txn.status      = "Returned"

    # Restore available copies
    txn.book.available_copies = min(
        txn.book.available_copies + 1,
        txn.book.total_copies,
    )

    # Calculate and persist fine if the book is overdue
    fine_amount  = calculate_fine(txn.due_date, return_date)
    days_overdue = max(0, (return_date - txn.due_date).days)

    if fine_amount > 0:
        if txn.fine:
            # Update existing fine record
            txn.fine.fine_amount    = fine_amount
            txn.fine.payment_status = "Pending"
        else:
            # Create a new fine record
            new_fine = Fine(
                transaction_id = txn.transaction_id,
                fine_amount    = fine_amount,
                payment_status = "Pending",
            )
            db.session.add(new_fine)

    db.session.commit()

    return success_response({
        "transaction":   txn.to_dict(),
        "student_name":  f"{txn.student.first_name} {txn.student.last_name}",
        "book_title":    txn.book.title,
        "fine_amount":   fine_amount,
        "days_overdue":  days_overdue,
        "return_date":   str(return_date),
    })


@app.route("/api/v1/transactions/renew/<transaction_id>", methods=["POST"])
def renew_book(transaction_id):
    """
    POST /api/v1/transactions/renew/<transaction_id>
    Extends the due_date of an active transaction by 14 days.
    """
    txn = Transaction.query.get_or_404(transaction_id)
    if txn.status != "Active":
        return error_response("Can only renew active loans.", 400)

    # Extend due date by 14 days
    txn.due_date = txn.due_date + timedelta(days=14)
    db.session.commit()

    return success_response(txn.to_dict())


# ---------------------------------------------------------------------------
# Routes – Fines
# ---------------------------------------------------------------------------

@app.route("/api/v1/fines", methods=["GET"])
def get_fines():
    """
    GET /api/v1/fines?status=<Pending|Paid>
    Returns all fine records enriched with student and book info.
    """
    status_filter = request.args.get("status", "").strip()
    query = Fine.query.join(Transaction).join(Student).join(Book)

    if status_filter:
        query = query.filter(Fine.payment_status == status_filter)

    fines = query.order_by(Fine.fine_id.desc()).all()

    result = []
    for fine in fines:
        item = fine.to_dict()
        item["student_name"] = (
            f"{fine.transaction.student.first_name} "
            f"{fine.transaction.student.last_name}"
        )
        item["student_id"] = fine.transaction.student_id
        item["book_title"] = fine.transaction.book.title
        item["due_date"]   = str(fine.transaction.due_date)
        result.append(item)

    return success_response(result)


@app.route("/api/v1/fines/<int:fine_id>/pay", methods=["POST"])
def pay_fine(fine_id):
    """
    POST /api/v1/fines/<fine_id>/pay
    Marks a fine as paid and records the payment date.
    """
    fine = Fine.query.get_or_404(fine_id)

    if fine.payment_status == "Paid":
        return error_response("This fine has already been paid.", 409)

    fine.payment_status = "Paid"
    fine.paid_date      = date.today()
    db.session.commit()

    return success_response(fine.to_dict())


@app.route("/api/v1/fines", methods=["POST"])
def create_fine():
    """
    POST /api/v1/fines
    Body: { student_id, amount, category, notes? }
    Manually issues/applies a fine to a student.
    """
    payload = request.get_json(silent=True) or {}
    student_id = payload.get("student_id")
    amount = payload.get("amount")
    category = payload.get("category", "Other")
    notes = payload.get("notes", "")
    transaction_id = payload.get("transaction_id")

    if not student_id or amount is None:
        return error_response("Missing required fields: student_id or amount.")

    txn = None
    if transaction_id:
        try:
            if isinstance(transaction_id, str) and transaction_id.upper().startswith("TRX-"):
                tx_id_int = int(transaction_id[4:])
            else:
                tx_id_int = int(transaction_id)
            txn = Transaction.query.filter_by(transaction_id=tx_id_int, student_id=student_id).first()
            if not txn:
                return error_response(f"No transaction found with ID TRX-{tx_id_int:04d} for this student.", 404)
        except ValueError:
            return error_response("Invalid transaction ID format.", 400)
    else:
        # Find latest transaction for this student
        txn = Transaction.query.filter_by(student_id=student_id).order_by(Transaction.transaction_id.desc()).first()
    if not txn:
        # Create completed placeholder transaction to satisfy NOT NULL unique foreign key constraint
        book = Book.query.first()
        if not book:
            return error_response("No books available in catalog to associate fine.", 400)
        txn = Transaction(
            book_id=book.book_id,
            student_id=student_id,
            issue_date=date.today(),
            due_date=date.today(),
            status="Returned",
            return_date=date.today()
        )
        db.session.add(txn)
        db.session.flush()

    if txn.fine:
        # Update existing fine
        txn.fine.fine_amount += float(amount)
        txn.fine.payment_status = "Pending"
        fine_record = txn.fine
    else:
        # Create new fine
        new_fine = Fine(
            transaction_id=txn.transaction_id,
            fine_amount=float(amount),
            payment_status="Pending"
        )
        db.session.add(new_fine)
        fine_record = new_fine

    db.session.commit()

    # Enrich response
    res = fine_record.to_dict()
    res["student_name"] = f"{txn.student.first_name} {txn.student.last_name}"
    res["student_id"] = txn.student_id
    res["book_title"] = txn.book.title
    res["due_date"] = str(txn.due_date)

    return success_response(res, 201)


# ---------------------------------------------------------------------------
# Health-check Endpoint
# ---------------------------------------------------------------------------

@app.route("/api/v1/health", methods=["GET"])
def health_check():
    """Simple liveness probe."""
    return success_response({"status": "ok", "timestamp": datetime.utcnow().isoformat()})


# ---------------------------------------------------------------------------
# Database Initialisation & Seed Data
# ---------------------------------------------------------------------------

def seed_database():
    """
    Populate the database with realistic sample data on first run.
    Skipped if data already exists.
    """
    if Student.query.first():
        return  # Already seeded

    print("  -> Seeding database with sample data...")

    # ---------------------------------------------------------------------
    # Students
    # ---------------------------------------------------------------------
    students = [
        Student(student_id="ST-8492", first_name="Eleanor", last_name="Vance",      email="evance@uni.edu",    phone="1234567890", status="Active"),
        Student(student_id="ST-9104", first_name="Arthur",  last_name="Hastings",   email="ahastings@uni.edu", phone="0987654321", status="Active"),
        Student(student_id="ST-1102", first_name="Jane",    last_name="Eyre",        email="jeyre@uni.edu",     phone="5551234567", status="Active"),
        Student(student_id="ST-4431", first_name="Holden",  last_name="Caulfield",  email="hcaulfield@uni.edu",phone="5559876543", status="Active"),
        Student(student_id="ST-1984", first_name="Winston", last_name="Smith",       email="wsmith@uni.edu",    phone="5558889999", status="Active"),
        Student(student_id="ST-0001", first_name="John",    last_name="Doe",         email="jdoe@uni.edu",      phone="1112223333", status="Active"),
        Student(student_id="ST-0002", first_name="Jane",    last_name="Smith",       email="jsmith@uni.edu",    phone="4445556666", status="Active"),
    ]
    db.session.add_all(students)

    # ---------------------------------------------------------------------
    # Books
    # ---------------------------------------------------------------------
    books = [
        Book(isbn="978-0465050659", title="The Design of Everyday Things",    author="Don Norman",            total_copies=5, available_copies=4, category="Literature"),
        Book(isbn="978-0132350884", title="Clean Code",                       author="Robert C. Martin",      total_copies=3, available_copies=2, category="Computer Science"),
        Book(isbn="978-1999026402", title="Refactoring UI",                   author="Adam Wathan",           total_copies=4, available_copies=4, category="Computer Science"),
        Book(isbn="978-0262033848", title="Introduction to Algorithms",       author="Thomas H. Cormen",      total_copies=6, available_copies=5, category="Computer Science"),
        Book(isbn="978-0374533557", title="Thinking, Fast and Slow",          author="Daniel Kahneman",       total_copies=8, available_copies=8, category="Literature"),
        Book(isbn="978-0141187884", title="The Haunting of Hill House",       author="Shirley Jackson",       total_copies=2, available_copies=1, category="Literature"),
        Book(isbn="978-0007120857", title="The Mysterious Affair at Styles",  author="Agatha Christie",       total_copies=3, available_copies=2, category="Literature"),
        Book(isbn="978-0415487412", title="Principles of Mathematics",        author="Bertrand Russell",      total_copies=1, available_copies=0, category="Mathematics"),
        Book(isbn="978-0316769174", title="The Catcher in the Rye",           author="J.D. Salinger",         total_copies=4, available_copies=3, category="Literature"),
        Book(isbn="978-0451524935", title="1984",                             author="George Orwell",         total_copies=5, available_copies=3, category="Literature"),
    ]
    db.session.add_all(books)
    db.session.flush()  # Flush so book_id values are assigned

    # ---------------------------------------------------------------------
    # Transactions (some overdue for dashboard realism)
    # ---------------------------------------------------------------------
    overdue_date = date.today() - timedelta(days=40)
    txns = [
        Transaction(transaction_id="TRX-0001", book_id=6, student_id="ST-8492", issue_date=overdue_date,                      due_date=overdue_date + timedelta(days=14), status="Active"),
        Transaction(transaction_id="TRX-0002", book_id=7, student_id="ST-9104", issue_date=overdue_date + timedelta(days=2),  due_date=overdue_date + timedelta(days=16), status="Active"),
        Transaction(transaction_id="TRX-0003", book_id=8, student_id="ST-1102", issue_date=overdue_date - timedelta(days=10), due_date=overdue_date + timedelta(days=4),  status="Active"),
        Transaction(transaction_id="TRX-0004", book_id=9, student_id="ST-4431", issue_date=overdue_date + timedelta(days=4),  due_date=overdue_date + timedelta(days=18), status="Active"),
        Transaction(transaction_id="TRX-0005", book_id=10,student_id="ST-1984", issue_date=overdue_date - timedelta(days=5),  due_date=overdue_date + timedelta(days=9),  status="Active"),
        Transaction(transaction_id="TRX-0006", book_id=2, student_id="ST-0001", issue_date=date.today() - timedelta(days=5),  due_date=date.today() + timedelta(days=9),  status="Active"),
        Transaction(transaction_id="TRX-0007", book_id=4, student_id="ST-0002", issue_date=date.today() - timedelta(days=3),  due_date=date.today() + timedelta(days=11), status="Active"),
    ]
    db.session.add_all(txns)
    db.session.flush()

    # ---------------------------------------------------------------------
    # Fines for overdue transactions
    # ---------------------------------------------------------------------
    for txn in txns[:5]:
        amount = calculate_fine(txn.due_date)
        if amount > 0:
            db.session.add(Fine(
                transaction_id = txn.transaction_id,
                fine_amount    = amount,
                payment_status = "Pending",
            ))

    db.session.commit()
    print("  [OK] Seed data inserted successfully.")


# ── Catch-All Route for Frontend ───────────────────────────────────────────
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return app.send_static_file(path)
    else:
        return app.send_static_file("index.html")


# ---------------------------------------------------------------------------
# Database & Migrations Initialization on Startup
# ---------------------------------------------------------------------------

with app.app_context():
    print("Initialising database...")
    db.create_all()           # Create tables if they don't exist

    # Safe migration: add book_image column if it doesn't exist yet
    # (handles existing library.db that pre-dates this column)
    import sqlite3
    db_path = os.path.join(BASE_DIR, "library.db")
    conn = sqlite3.connect(db_path)
    existing_cols = [row[1] for row in conn.execute("PRAGMA table_info(books)").fetchall()]
    if "book_image" not in existing_cols:
        conn.execute("ALTER TABLE books ADD COLUMN book_image TEXT")
        conn.commit()
        print("  -> Migrated: added book_image column to books table.")
    conn.close()

    seed_database()           # Populate sample data on first run
    print("[OK] Database ready.")


# ---------------------------------------------------------------------------
# Entry Point (for local development only)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("\n[*] Library Management API running at http://127.0.0.1:5000")
    print("   CORS enabled for all origins on /api/* routes.\n")
    app.run(debug=True, host="0.0.0.0", port=5000)

