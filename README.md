# TaskFlow

A task manager with user accounts. Each user only sees and edits their own tasks.

**Stack:** Node.js, Express, SQLite (better-sqlite3), JWT authentication, bcrypt, vanilla JavaScript (HTML/CSS/JS).

## Features
- Register and log in (passwords hashed with bcrypt, sessions via JWT)
- Create, complete, and delete tasks with low/medium/high priority
- Filter by All / Active / Done
- Every task route is protected and scoped to the logged-in user
- Server-side validation and safe DOM rendering (no `innerHTML` with user data)

## Run it
Needs Node.js 18+ (nodejs.org). In this folder:

```
npm install
npm start
```

Open http://localhost:3000

## API
| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | /api/register | no | Create account, returns token |
| POST | /api/login | no | Log in, returns token |
| GET | /api/tasks | yes | List my tasks |
| POST | /api/tasks | yes | Create task |
| PATCH | /api/tasks/:id | yes | Update title / done |
| DELETE | /api/tasks/:id | yes | Delete task |

## Interview talking points (read the code once, then explain in your own words)

**How does login work?**
On register/login the server hashes or checks the password with bcrypt, then signs a JWT containing the user id. The browser stores the token and sends it in the `Authorization: Bearer` header. The `requireAuth` middleware in `server.js` verifies it and sets `req.userId`.

**How do you stop one user reading another user's tasks?**
Every query includes `WHERE user_id = ?` using the id from the verified token, never an id sent by the client. Deleting someone else's task returns 404.

**Why bcrypt and not plain or SHA hashing?**
bcrypt is deliberately slow and salted, which makes brute-forcing leaked hashes expensive.

**Why SQLite here?**
Zero setup and fine for a small app. For multi-user production I would move to PostgreSQL; the SQL is simple enough to port.

**Known limitations (be honest about these):**
JWT is kept in localStorage (an httpOnly cookie is safer against XSS), there is no rate limiting on login, and the dev secret must be replaced with the `JWT_SECRET` environment variable in production.

## Upload to GitHub
```
git init
git add .
git commit -m "TaskFlow: Express + SQLite task manager with JWT auth"
git branch -M main
git remote add origin https://github.com/YOUR_REAL_USERNAME/taskflow.git
git push -u origin main
```
