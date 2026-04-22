# Jeroen Backend 🚀

Professional Node.js backend for the Jeroen Recipe & User Management system. Powered by Express and MongoDB Atlas.

## 🛠 Features

- **Recipe Management API**: Full CRUD operations for recipes.
- **Advanced Filtering**: Search by name (partial match), category, and cookbook.
- **Robust Data Migration**: Custom scripts to import recipes from raw JSON cookbooks into MongoDB.
- **Image Handling**: Local file upload support via Multer.
- **Secure Configuration**: Environment-based configuration using `.env`.

## 📦 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Atlas)
- **ODM**: Mongoose
- **File Uploads**: Multer
- **Environment**: Dotenv

## 🚀 Getting Started

### 1. Prerequisites
- Node.js installed
- MongoDB Atlas account (or local MongoDB)

### 2. Installation
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
```

### 4. Run the Server
```bash
npm start
```
The server will run on `http://localhost:5000`.

### 5. Import Recipes
To import the 844 recipes from the `jeroen_im` cookbooks:
```bash
npm run import
```

## 🛤 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/recipes` | List recipes (supports `search`, `category`, `book`) |
| `GET` | `/api/recipes/:id` | Get recipe details |
| `POST` | `/api/recipes` | Create a new recipe |
| `PUT` | `/api/recipes/:id` | Update an existing recipe |
| `DELETE` | `/api/recipes/:id` | Delete a recipe |
| `GET` | `/api/health` | Backend health check |

## 🏗 Project Structure
- `config/`: Configuration files (Multer, etc.)
- `models/`: Mongoose schemas (Recipe, etc.)
- `routes/`: Express route definitions
- `scripts/`: Maintenance and migration scripts (Import utility)
- `utils/`: Shared utility functions (Data transformers)
- `uploads/`: Local storage for uploaded recipe images
