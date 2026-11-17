# StudyMate – Study Material Helper

A web platform where faculty share study materials and students find, save and download them. Materials are organized by subject, unit and type, and every user gets a screen that matches their role: **Admin**, **Faculty** or **Student**.

**Live demo:** https://ashokak21.github.io/Study-Mate/

## Features

**Everyone**
- Log in with e-mail ID, registration number or username
- Role-based dashboard and menus
- Edit profile (photo, phone, bio) and change password with a strength indicator
- Read announcements
- Logout asks for confirmation, and you are logged out automatically after 30 minutes of inactivity
- Light and dark theme, works on phone and desktop

**Student**
- Register with a registration number (`RA2511` followed by 9 digits, for example `RA2511000000123`)
- Search by title or description, filter by subject and type, sort by newest or most downloaded
- Save materials and view the saved list
- Download materials

**Faculty**
- Upload material with title, description, subject, unit, type and file (up to 25 MB)
- Edit details, replace the file, or delete own materials
- Post and remove announcements
- See download counts

**Admin**
- Create and remove users, reset passwords
- Add and remove subjects
- View and manage all materials and announcements

## Demo accounts

| Role | Login | Password |
|---|---|---|
| Admin | `admin@college.edu` (or `admin`) | `admin123` |
| Faculty | `meena@college.edu` (or `meena`) | `faculty123` |
| Student | `arun@college.edu` (or `RA2511000000001`) | `student123` |

## Tech stack

| Area | Technology |
|---|---|
| Front end | HTML5, CSS3, JavaScript (ES6), no framework |
| Records | Browser `localStorage` (users, subjects, materials, announcements as JSON) |
| Files | Browser `IndexedDB` (uploaded files) |
| Security | Web Crypto API (SHA-256 password hashes), HTML escaping, login lock, auto logout |
| Hosting | GitHub Pages |
| Optional server | Node.js (no extra packages) |

## Run it locally

The browser version is one file, `index.html`.

1. Download or clone this repository.
2. Open `index.html` in a browser, or serve the folder:
   ```bash
   python -m http.server 8000
   ```
   Then open http://localhost:8000

## Run the Node.js server version (optional)

The server version has the same screens but saves data and files on the server, so every device sees the same data.

1. Install Node.js 18 or newer.
2. Put `server.js` and `package.json` in one folder, with the page files inside a `public` folder (`public/index.html` and `public/app.js`).
3. Run:
   ```bash
   node server.js
   ```
4. Open http://localhost:3000

## How it works

- The app is a single-page application. Every action changes the data, saves it, and redraws the screen.
- Passwords are never stored as plain text; they are saved as SHA-256 hashes.
- Student accounts are tied to registration numbers, and e-mail IDs are unique.
- In the browser version, role checks happen in the interface. The server version checks roles on every request.

## Limitations

- In the browser version, data lives in each user's own browser, so an upload on one device does not appear on another. The Node.js version removes this limit.
- Clearing the browser's site data erases the data in the browser version.
- The first time the site opens in a browser, it loads demo data.

## Future scope

- Host the server version with a database such as MongoDB or MySQL
- E-mail notifications for new materials and announcements
- File preview inside the page
- Ratings and comments on materials
- Report of the most downloaded materials

## Author

**Ashokkumar R**
Register No.: RA2511026050188
2nd Year, AIML C
