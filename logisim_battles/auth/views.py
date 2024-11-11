from logisim_battles.utils.forms import validate_field
from logisim_battles.auth.models import User
from logisim_battles.extensions import db

from flask_login import login_user
from flask import Blueprint, render_template, request, flash, redirect


auth_blueprint = Blueprint("auth", __name__, url_prefix="/auth")


@auth_blueprint.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "GET":
        return render_template("auth/register.html")

    username, error = validate_field(request.form["username"], 1, 30, "username")
    if not username:
        flash(error, 'error')
        return render_template('auth/register.html')
    
    email, error = validate_field(request.form["email"], 3, 255, "email")
    if not email:
        flash(error, 'error')
        return render_template('auth/register.html')
    
    password, error = validate_field(request.form["password"], 8, 255)
    if not password:
        flash(error, 'error')
        return render_template('auth/register.html')

    user = User(email, password, username)

    db.session.add(user)
    db.session.commit()
        
    login_user(user)
        
    flash('Registration successful. Welcome!', 'success')
    return redirect("/app/battle")


@auth_blueprint.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("auth/login.html")

    user = request.form['user']
    password = request.form['password']
        
    _user = User.authenticate(user, password)
    if not _user:
        flash(f"Invalid {'email' if '@' in user else 'username'} or password", 'error')
        return render_template('auth/login.html')
    
    login_user(user)
    return redirect(request.args.get("next", "/app/battle"))
