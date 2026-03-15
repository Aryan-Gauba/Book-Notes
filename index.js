import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Database Connection
const db = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// 1. READ - Home Route with Sorting
app.get("/", async (req, res) => {
  const sort = req.query.sort || 'rating'; // Default sort by rating
  let orderBy = "rating DESC";

if (sort === 'recency') {
  // Sort by date first, then by ID for the newest entry
  orderBy = "date_read DESC, id DESC"; 
} else if (sort === 'title') {
    orderBy = "title ASC";
  }

  try {
    const result = await db.query(`SELECT * FROM books ORDER BY ${orderBy}`);
    res.render("index.ejs", { books: result.rows, currentSort: sort });
  } catch (err) {
    console.error("Error executing query", err.stack);
    res.status(500).send("Internal Server Error");
  }
});

// 2. CREATE - Render Add Page
app.get("/add", (req, res) => {
  res.render("modify.ejs", { heading: "Add a New Book", book: {} });
});

// 3. CREATE - Post New Book
// app.post("/add", async (req, res) => {
//   const { isbn, rating, notes } = req.body;

//   try {
//     // 1. Use Axios to fetch book metadata
//     // Note: We use the .json endpoint for specific ISBNs
//     const response = await axios.get(`https://openlibrary.org/isbn/${isbn}.json`);
//     const bookData = response.data;

//     // 2. Extract the Title
//     const title = bookData.title;

//     // 3. Extract the Author (API returns an array of keys, e.g., /authors/OL123A)
//     // We'll set a default, but you can add a second Axios call here later to get the name!
//     const author = "Author data fetched via API"; 

//     // 4. Save everything to PostgreSQL
//     await db.query(
//       "INSERT INTO books (isbn, title, author, rating, notes) VALUES ($1, $2, $3, $4, $5)",
//       [isbn, title, author, rating, notes]
//     );

//     res.redirect("/");
//   } catch (err) {
//     console.error("Error adding book:", err.message);
    
//     // Friendly error handling if the ISBN isn't found
//     res.status(500).send(`
//       <h2>Could not find a book with ISBN: ${isbn}</h2>
//       <p>Please check the number and try again.</p>
//       <a href="/add">Back to Add Page</a>
//     `);
//   }
// });

app.post("/add", async (req, res) => {
  const { isbn, rating, notes } = req.body;
  try {
    const response = await axios.get(`https://openlibrary.org/isbn/${isbn}.json`);
    const bookData = response.data;

    // Inside your POST /add route
    let authorName = "Unknown Author";

    if (bookData.authors && bookData.authors.length > 0) {
      const authorEntry = bookData.authors[0];
      
      if (authorEntry.name) {
        // Some responses already include the name string
        authorName = authorEntry.name;
      } else if (authorEntry.key) {
        // If only a key is provided, we do the second call
        const authorResponse = await axios.get(`https://openlibrary.org${authorEntry.key}.json`);
        authorName = authorResponse.data.name;
      }
    }

    await db.query(
      "INSERT INTO books (isbn, title, author, rating, notes) VALUES ($1, $2, $3, $4, $5)",
      [isbn, bookData.title, authorName, rating, notes]
    );
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding book.");
  }
});

// 4. UPDATE - Render Edit Page
app.get("/edit/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await db.query("SELECT * FROM books WHERE id = $1", [id]);
    res.render("modify.ejs", { heading: "Edit Note", book: result.rows[0] });
  } catch (err) {
    res.status(404).send("Book not found");
  }
});

// 5. UPDATE - Post Changes
app.post("/edit/:id", async (req, res) => {
  const id = req.params.id;
  const { rating, notes } = req.body;
  try {
    await db.query("UPDATE books SET rating = $1, notes = $2 WHERE id = $3", [rating, notes, id]);
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.redirect(`/edit/${id}`);
  }
});

// 6. DELETE
app.post("/delete/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await db.query("DELETE FROM books WHERE id = $1", [id]);
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting book");
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});