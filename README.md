# POS & Inventory Management System

A comprehensive web-based Point of Sale (POS) and inventory management system designed for cafes and restaurants. This application streamlines operations by integrating sales, inventory tracking, financial management, and reporting into a single platform.

## Features

*   **Point of Sale (POS):**
    *   User-friendly interface for processing orders.
    *   Support for multiple payment methods.
    *   Shift management (cashier shifts, cash reconciliation).
    *   Receipt printing support.
*   **Inventory Management:**
    *   Product and raw material tracking.
    *   Recipe management (linking products to raw materials).
    *   Stock alerts and expiration tracking.
    *   Supplier and purchase order management.
*   **Finance:**
    *   Expense tracking.
    *   Sales journals and bank reconciliation.
    *   Daily financial reports.
*   **Dashboard & Analytics:**
    *   Real-time overview of sales and performance.
    *   Detailed reports (Sales, Inventory, Financial).
*   **User Management:**
    *   Role-based access control (Admins, Staff, Cashiers).
*   **Localization:**
    *   Built-in support for Arabic language (UI and Receipt printing).

## Tech Stack

### Backend
*   **Framework:** Django
*   **API:** Django REST Framework (DRF)
*   **Database:** SQLite (Default, configurable)
*   **Authentication:** JWT (JSON Web Tokens)
*   **Utilities:**
    *   `pdfkit` for PDF generation.
    *   `pandas` & `openpyxl` for data processing and Excel export.
    *   `arabic-reshaper` & `python-bidi` for correct Arabic text rendering.

### Frontend
*   **Framework:** React (Vite)
*   **Styling:** Tailwind CSS
*   **State Management:** Zustand
*   **Routing:** React Router
*   **HTTP Client:** Axios
*   **Charts:** Recharts

## Installation

### Prerequisites
*   Python 3.10+
*   Node.js 18+
*   npm or yarn

### Backend Setup

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```

2.  Create and activate a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

4.  Apply database migrations:
    ```bash
    python manage.py migrate
    ```

5.  Create a superuser (for admin access):
    ```bash
    python manage.py createsuperuser
    ```

6.  Run the development server:
    ```bash
    python manage.py runserver
    ```
    The backend API will be available at `http://localhost:8000`.

### Frontend Setup

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```
    The frontend application will be available at `http://localhost:5173`.

## Usage

1.  Open your browser and navigate to the frontend URL (`http://localhost:5173`).
2.  Log in using your credentials.
3.  Access the Django Admin interface at `http://localhost:8000/admin` to manage users and initial data.

## Project Structure

```
.
├── backend/                # Django backend application
│   ├── authentication/     # User authentication and management
│   ├── core/               # Project settings and configuration
│   ├── customers/          # Customer management
│   ├── finance/            # Financial tracking and reports
│   ├── inventory/          # Inventory and stock management
│   ├── pos/                # Point of Sale logic
│   ├── reports/            # Reporting module
│   └── ...
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── api/            # API integration services
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages (POS, Dashboard, etc.)
│   │   └── store/          # State management stores
│   └── ...
└── README.md               # Project documentation
```

## Notes

*   **Arabic Support:** The system is configured with `ar-eg` language code and includes libraries to handle Arabic text correctly, especially for PDF generation and receipt printing.
*   **Timezone:** Default timezone is set to `Africa/Cairo`.
