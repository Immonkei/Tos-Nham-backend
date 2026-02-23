# Restaurant Management System - Backend

This repository contains the complete Node.js Express backend for a comprehensive Restaurant Management System. It provides a robust, scalable, and secure foundation for managing restaurant operations, including authentication, multi-branch support, menu management, reservations, online ordering, payments, and an admin dashboard.

## ✨ Core Features

1.  **Authentication & Authorization**
    *   User registration (Customer, Staff, Admin).
    *   Login with secure JWT (JSON Web Token).
    *   Password hashing using `bcrypt`.
    *   Role-Based Access Control (RBAC) to protect routes.

2.  **Branch Management**
    *   Admin can create, update, and (soft) delete branches.
    *   Public endpoint to get a list of all active branches.
    *   All relevant data (orders, menus, reservations) is filtered by `branch_id`.

3.  **Menu Management**
    *   Manage categories and menu items per branch.
    *   Supports image uploads for menu items (`multer`).
    *   CRUD operations for menu items and categories.
    *   Public endpoint to fetch the menu for a specific branch.

4.  **Reservation System (Table Booking)**
    *   Customers can create reservations.
    *   Automatic calculation of a 50% deposit.
    *   Generates a unique QR token upon deposit payment confirmation.
    *   Staff can validate the QR token upon guest arrival to mark them as "Arrived".

5.  **Order System (Online Orders)**
    *   Supports dine-in, delivery, and takeaway orders.
    *   Transactional creation of orders and their associated items.
    *   Staff can update order status through a defined flow (Pending → Confirmed → Preparing → Ready → Completed).
    *   Customers can view their order history.

6.  **Payment System**
    *   Records payments for both orders and reservation deposits.
    *   Supports uploading receipt images for verification.
    *   Admin can approve or reject payments, which updates the corresponding order/reservation status.

7.  **QR System**
    *   Generates unique, secure tokens for each confirmed reservation.
    *   Provides an endpoint for staff to scan and validate QR codes, preventing reuse.

8.  **Dashboard & Reports**
    *   Summary endpoint for daily statistics (orders, reservations, sales).
    *   Filter reports by branch and date range.
    *   Detailed sales reports, order statistics, and reservation analytics.

## 🛠️ Tech Stack

*   **Backend**: Node.js, Express.js
*   **Database**: MySQL with Sequelize ORM
*   **Authentication**: JSON Web Tokens (JWT), bcrypt
*   **File Uploads**: Multer
*   **Other Key Libraries**: `cors`, `helmet`, `morgan`, `express-validator`, `qrcode`

## 📂 Project Structure

```
/home/ubuntu/restaurant-backend
├── src
│   ├── config          # Database config, sync script
│   ├── controllers     # Business logic for each module
│   ├── middleware      # Auth, validation, error handling
│   ├── models          # Sequelize model definitions and associations
│   ├── routes          # API route definitions
│   └── utils           # Helper functions (QR generation, file uploads)
├── uploads             # Directory for storing uploaded images
│   ├── menu
│   └── receipts
├── .env.example        # Example environment variables
├── app.js              # Main application entry point
├── package.json
└── README.md
```

## 🚀 Getting Started

### 1. Prerequisites

*   Node.js (v16+)
*   npm
*   A running MySQL database instance.

### 2. Clone & Install

```bash
# Navigate to the project directory
cd /home/ubuntu/restaurant-backend

# Install dependencies
npm install
```

### 3. Environment Configuration

Create a `.env` file in the project root by copying the example file:

```bash
cp .env.example .env
```

Now, edit the `.env` file with your specific configuration:

```dotenv
# ─── Server Configuration ───────────────────────────────────────────────────
NODE_ENV=development
PORT=5000

# ─── Database Configuration (MySQL) ─────────────────────────────────────────
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=restaurant_db

# ─── JWT Authentication ─────────────────────────────────────────────────────
# Use a long, random, and secure string for JWT_SECRET
JWT_SECRET=your_super_secret_jwt_key_that_is_very_long_and_random
JWT_EXPIRES_IN=7d

# ─── Password Hashing ───────────────────────────────────────────────────────
BCRYPT_ROUNDS=12
```

### 4. Database Synchronization

Run the following command to automatically create all the necessary tables in your database based on the Sequelize models.

```bash
npm run db:sync
```

### 5. Run the Server

*   **Development Mode** (with hot-reloading via `nodemon`):

    ```bash
    npm run dev
    ```

*   **Production Mode**:

    ```bash
    npm start
    ```

The server will be running at `http://localhost:5000`.

## 📝 API Endpoints

A Postman collection can be generated from the routes to explore all available endpoints. Here is a high-level overview:

| Module        | Endpoint Prefix           | Authentication Required |
|---------------|---------------------------|-------------------------|
| Health Check  | `/api/health`             | No                      |
| Auth          | `/api/auth`               | Varies (Login/Register=No) |
| Branches      | `/api/branches`           | Varies (GET=No)         |
| Menu          | `/api/menu`               | Varies (GET=No)         |
| Reservations  | `/api/reservations`       | Yes                     |
| Orders        | `/api/orders`             | Yes                     |
| Payments      | `/api/payments`           | Yes                     |
| QR Validation | `/api/qr`                 | Yes (Staff/Admin)       |
| Dashboard     | `/api/dashboard`          | Yes (Staff/Admin)       |

**Key Protected Routes:**
*   Routes requiring `roleMiddleware("admin")` are accessible only by users with the `admin` role.
*   Routes requiring `roleMiddleware("admin", "staff")` are accessible by both admins and staff.
*   The `branchAccessMiddleware` ensures that staff can only manage resources (like menu items or orders) associated with their assigned branch.
