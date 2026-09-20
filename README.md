# Event Booking System

A full-stack web application for booking seats at college events. Students can browse upcoming events, book seats and manage their bookings. Admins can create categories and events and see every booking.

The backend is a REST API built with Node.js, Express and MongoDB. The frontend (called **CampusPass**) is plain HTML, CSS and JavaScript, served by the same Express server.

## Features

**For users**
- Sign up and log in (JWT authentication)
- Browse upcoming events and filter them by category
- See how many seats are left for each event
- Book one or more seats, with the total price shown before confirming
- View "My bookings" and cancel a booking (seats go back to the event)

**For admins**
- Add categories
- Add and delete events
- See all bookings from all users and cancel any booking

**Rules built into the system**
- Only logged-in users can book
- Only admins can create, update or delete categories and events
- A booking cannot exceed the seats available, so an event can never be overbooked
- Past events cannot be booked
- A user can cancel only their own booking (admins can cancel any)

## Tech stack

| Part | Technology |
|---|---|
| Backend | Node.js, Express 5 |
| Database | MongoDB with Mongoose 9 |
| Authentication | JSON Web Tokens (jsonwebtoken), passwords hashed with bcrypt |
| Frontend | HTML, CSS, vanilla JavaScript (no framework) |
| Dev tool | nodemon |

## Project structure

```
Event-Booking-System/
├── config/
│   └── db.js                  # MongoDB connection
├── controller/
│   ├── authController.js      # register, login
│   ├── categoryController.js  # list and create categories
│   ├── eventController.js     # event CRUD
│   └── bookingController.js   # book, my bookings, cancel, all bookings
├── middleware/
│   ├── authMiddleware.js      # protect: checks the JWT token
│   └── roleMiddleware.js      # adminOnly: allows admins only
├── models/
│   ├── userModel.js
│   ├── categoryModel.js
│   ├── eventModel.js
│   └── bookingModel.js
├── routes/
│   ├── authRoutes.js
│   ├── categoryRoutes.js
│   ├── eventRoutes.js
│   └── bookingRoutes.js
├── utils/
│   └── tokenUtils.js          # creates JWT tokens
├── public/                    # frontend
│   ├── index.html
│   ├── style.css
│   └── app.js
├── index.js                   # server entry point
└── package.json
```

## How a request flows

```
Browser / Postman -> routes -> middleware (login / admin check) -> controller -> model -> MongoDB
```

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- MongoDB, either installed locally or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/ayushparmar01/Event-Booking-System.git
   cd Event-Booking-System
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root

   ```env
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/event-booking
   JWT_SECRET=use_a_long_random_secret_here
   ```

   If you use MongoDB Atlas, put your Atlas connection string in `MONGO_URI`.

4. Start the server

   ```bash
   npm run dev
   ```

   You should see:

   ```
   Server running on port 5000
   MongoDB connected
   ```

5. Open the app in your browser: **http://localhost:5000**

To run without auto-restart, use `npm start`.

### Creating the first admin

For safety, everyone who registers gets the role `user`. To create an admin:

1. Register a normal account from the website.
2. Open MongoDB Compass (or Atlas), go to your database and open the `users` collection.
3. Find your user and change `role` from `"user"` to `"admin"`. Save.
4. Log out and log in again. The **Admin** link now appears in the menu.

### First steps as admin

1. Open the **Admin** page and add a category (for example "Tech").
2. Add an event: title, description, date (in the future), location, price, total seats and category.
3. Go to **Events**. The event appears as a ticket with a **Book seats** button.

## API reference

Base URL: `http://localhost:5000/api`

For protected routes, send the token in the header:

```
Authorization: Bearer <your_token>
```

### Auth

| Method | Endpoint | Access | Body |
|---|---|---|---|
| POST | `/auth/register` | Public | `name`, `email`, `password` (min 8 characters) |
| POST | `/auth/login` | Public | `email`, `password` |

Both return a `token` and the `user` object.

### Categories

| Method | Endpoint | Access | Body |
|---|---|---|---|
| GET | `/categories` | Public | none |
| POST | `/categories` | Admin | `name` |

### Events

| Method | Endpoint | Access | Body |
|---|---|---|---|
| GET | `/events` | Public | none. Optional `?category=<id>` filter |
| GET | `/events/:id` | Public | none |
| POST | `/events` | Admin | `title`, `description`, `date`, `location`, `price`, `totalSeats`, `category` |
| PUT | `/events/:id` | Admin | any of the event fields above |
| DELETE | `/events/:id` | Admin | none |

### Bookings

| Method | Endpoint | Access | Body |
|---|---|---|---|
| POST | `/bookings` | Logged-in user | `eventId`, `seats` |
| GET | `/bookings/my` | Logged-in user | none |
| PUT | `/bookings/:id/cancel` | Owner or admin | none |
| GET | `/bookings` | Admin | none |

### Health check

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Returns a message if the server is running |

## Data models

**User**: `name`, `email` (unique), `password` (hashed), `role` (`user` or `admin`)

**Category**: `name` (unique)

**Event**: `title`, `description`, `date`, `location`, `price`, `totalSeats`, `availableSeats`, `category` (reference), `createdBy` (reference)

**Booking**: `user` (reference), `event` (reference), `seats`, `totalPrice`, `status` (`confirmed` or `cancelled`)

## How it works

**Authentication.** On login the server creates a JWT containing the user's id. The browser stores it and sends it with every request. The `protect` middleware verifies the token and loads the user. The `adminOnly` middleware then checks the user's role.

**Seat booking.** When a user books, the server checks and reduces `availableSeats` in a single database operation. If two people try to book the last seat at the same moment, only one succeeds. Cancelling a booking adds the seats back.

**Security.** Passwords are hashed with bcrypt and never returned by the API. The role cannot be chosen at registration. The frontend escapes all text it shows, so event titles cannot inject scripts.

## Testing the API

Use Thunder Client (VS Code) or Postman. A good order to test:

1. Register and log in, then copy the token
2. Make your user an admin in the database
3. Create a category, then an event
4. Log in as a normal user and book seats
5. Check that `availableSeats` went down, then cancel and check that it went back up

## Known limitations and future improvements

- Editing an event is available through the API only (`PUT /events/:id`), not yet in the admin page
- Deleting an event does not delete its bookings, so those bookings show "Event removed"
- No online payment. `totalPrice` is only calculated and stored
- No email or SMS confirmation
- Possible additions: event images, search by title, booking history export, password reset

## Author

Ayush ([@ayushparmar01](https://github.com/ayushparmar01))
