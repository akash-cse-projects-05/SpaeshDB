# 🩺 Sparsh – Touch of Care

Sparsh is a secure, compassionate, and highly confidential telehealth platform designed for emergency PEP (Post-Exposure Prophylaxis) consultations, PrEP (Pre-Exposure Prophylaxis) ongoing plans, and general HIV/AIDS counseling. 

It is built following the **Model-View-Controller (MVC)** architecture pattern with Express.js, EJS templates, Mongoose (MongoDB), and Passport.js.

---

## 🌟 Key Features

1. **🔒 Anonymity-First Registration:** Patients can choose to stay completely anonymous. Real names and emails are masked automatically from practitioner portals.
2. **📅 Interactive Availability Planners:** Doctors can schedule their weekly day/time slots directly from their dashboard.
3. **💳 Mock Payment Gateway:** Integrated Razorpay & UPI simulated overlay system to model payment confirmation.
4. **💬 Digital Prescriptions & Messaging:** Instant messaging workflow between doctors and patients on active consultation files, with printable digital prescriptions.
5. **✍️ Educational Content Creator:** Admin panel with a direct-publishing blog engine to share medical articles.

---

## 🛠️ Technology Stack

- **Backend Architecture:** Node.js, Express.js (MVC)
- **Database Layer:** MongoDB (Mongoose ORM)
- **Session Security:** Passport.js, Express-session, Bcryptjs, Connect-Mongo
- **Template System:** EJS (Embedded JavaScript)
- **Styling Paradigm:** Premium Vanilla CSS (slate backgrounds, glassmorphism, responsive grid layouts, custom variables)
- **Testing Engine:** Jest & Supertest

---

## 📂 Project Structure

```
├── server.js                   # Main application entry point
├── src/
│   ├── app.js                  # Application setup & middleware bindings
│   ├── config/
│   │   ├── db.js               # Database connection helper
│   │   └── passport.js         # Passport auth strategies
│   ├── controllers/
│   │   ├── adminController.js  # Admin operations controller
│   │   ├── authController.js   # Authentication controller
│   │   ├── doctorController.js # Doctor scheduling controller
│   │   ├── patientController.js# Patient portal controller
│   │   ├── staticController.js # Static views & blog controller
│   │   └── appointmentController.js # Shared consultations controller
│   ├── middleware/
│   │   └── auth.js             # Route protections & role guards
│   ├── models/
│   │   ├── User.js             # User & Patient DB schema
│   │   ├── Doctor.js           # Doctor schema with schedule availability
│   │   ├── Appointment.js      # Appointments, chats & prescriptions schema
│   │   └── Article.js          # Blog post schema
│   ├── routes/
│   │   ├── admin.js            # Admin panel routes
│   │   ├── auth.js             # Auth actions routes
│   │   ├── doctor.js           # Doctor panel routes
│   │   ├── patient.js          # Patient portal routes
│   │   ├── static.js           # General routes (Home, FAQs, Blog)
│   │   └── appointments.js     # Shared consultations routing
│   ├── public/
│   │   ├── css/
│   │   │   └── style.css       # Unified dark mode layout styles
│   │   └── js/
│   │       └── main.js         # Client-side validation & payment modal triggers
│   └── views/
│       ├── partials/           # Layout blocks (Header, Footer)
│       ├── auth/               # Signup & Sign-in panels
│       ├── patient/            # Patient dashboard & booking screens
│       ├── doctor/             # Doctor dashboard & availability grids
│       ├── admin/              # Admin dashboard with blog publisher
│       ├── appointments/       # Consult, prescription updates & chat log view
│       └── static/             # 404 & 500 error templates
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or above recommended)
- [MongoDB](https://www.mongodb.com/) (running locally or via MongoDB Atlas connection URI)

### 2. Installation
Clone the repository and run the package installer:
```bash
npm install
```

### 3. Environment Configuration
### 3. Environment Configuration
Copy the provided `.env.example` file to create your `.env`:
```bash
cp .env.example .env
```
Fill in your MongoDB connection string and session secret in `.env`.

### 4. Running the App
Start the development server with live reload:
```bash
npm run dev
```
Or start the production server:
```bash
npm start
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## 🔑 Default Administrator Account

The system automatically initializes the default administrator on first boot:

| Role | Email | Default Password | Dashboard |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@sparsh.org` | `adminpassword123` | `/admin/dashboard` |

*(You can override the default admin password by setting `ADMIN_PASSWORD` in your `.env` file.)*

---

## 🧪 Running Integration Tests

Execute the automated test suite with Jest:
```bash
npm test
```
This runs Supertest suite validations checking public layout responses and route guard redirections.
