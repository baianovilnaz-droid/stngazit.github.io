/* =====================================
   1. ПОДКЛЮЧЕНИЕ SUPABASE
===================================== */

// ВСТАВЬ СВОЙ PROJECT URL
const SUPABASE_URL = "https://ygzthvzoxbyrwzbyqgxa.supabase.co";

// ВСТАВЬ СВОЙ PUBLISHABLE KEY
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnenRodnpveGJ5cnd6YnlxZ3hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2MTQ0MjYsImV4cCI6MjExMTE5MDQyNn0.toMNBmJ4jJ77ymV0OX7ShGCxTKBzS13U1H3p-VyJOwg";

// ПОДКЛЮЧЕНИЕ
const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


/* =====================================
   2. ПОЛЬЗОВАТЕЛЬ
===================================== */

let currentUser = null;


/* =====================================
   3. ПОКАЗ СТРАНИЦЫ
===================================== */

function showPage() {

  document.getElementById("auth").hidden = !!currentUser;

  document.getElementById("social").hidden = !currentUser;

  document.getElementById("logoutBtn").hidden = !currentUser;

  if (currentUser) {
    loadPosts();
  }
}


/* =====================================
   4. СООБЩЕНИЯ
===================================== */

function showMessage(message) {
  document.getElementById("message").textContent = message;
}


/* =====================================
   5. ПРОВЕРКА АВТОРИЗАЦИИ
===================================== */

async function checkUser() {

  const { data, error } = await db.auth.getSession();

  if (error) {
    showMessage(error.message);
    return;
  }

  currentUser = data.session?.user || null;

  showPage();
}


/* =====================================
   6. РЕГИСТРАЦИЯ
===================================== */

async function register() {

  const email = document.getElementById("email").value.trim();

  const password = document.getElementById("password").value;

  const username = document.getElementById("username").value.trim();

  if (!email || password.length < 6 || username.length < 3) {
    return showMessage("Проверь введённые данные");
  }

  const { data, error } = await db.auth.signUp({

    email: email,

    password: password,

    options: {
      data: {
        username: username
      }
    }

  });

  if (error) {
    showMessage(error.message);
    return;
  }

  if (data.session) {

    currentUser = data.session.user;

    showPage();

  } else {

    showMessage("Регистрация успешна! Подтверди почту.");

  }
}


/* =====================================
   7. ВХОД
===================================== */

async function login() {

  const email = document.getElementById("email").value.trim();

  const password = document.getElementById("password").value;

  const { data, error } = await db.auth.signInWithPassword({

    email: email,

    password: password

  });

  if (error) {
    showMessage(error.message);
    return;
  }

  currentUser = data.user;

  showPage();
}


/* =====================================
   8. ВЫХОД
===================================== */

async function logout() {

  const { error } = await db.auth.signOut();

  if (error) {
    alert(error.message);
    return;
  }

  currentUser = null;

  showPage();
}


/* =====================================
   9. СОЗДАНИЕ ПУБЛИКАЦИИ
===================================== */

async function publish() {

  if (!currentUser) return;

  const button = document.getElementById("publishBtn");

  const content = document.getElementById("content").value.trim();

  const file = document.getElementById("photo").files[0];

  if (!content && !file) {
    alert("Добавь текст или фотографию!");
    return;
  }

  if (content.length > 2000) {
    alert("Максимум 2000 символов");
    return;
  }

  button.disabled = true;

  let image_url = null;

  try {

    // ЗАГРУЗКА ФОТОГРАФИИ

    if (file) {

      if (!file.type.startsWith("image/") ||
          file.size > 5 * 1024 * 1024) {

        throw new Error("Изображение должно быть до 5 МБ");

      }

      const extension = file.name.split(".").pop().toLowerCase();

      const path =
        currentUser.id + "/" +
        crypto.randomUUID() + "." + extension;

      const { error: uploadError } = await db.storage
        .from("post-images")
        .upload(path, file, {
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      image_url = db.storage
        .from("post-images")
        .getPublicUrl(path)
        .data.publicUrl;

    }

    // СОХРАНЕНИЕ ПУБЛИКАЦИИ

    const { error } = await db
      .from("posts")
      .insert({

        user_id: currentUser.id,

        content: content,

        image_url: image_url

      });

    if (error) throw error;

    document.getElementById("content").value = "";

    document.getElementById("photo").value = "";

    await loadPosts();

  } catch (error) {

    alert(error.message);

  } finally {

    button.disabled = false;

  }
}


/* =====================================
   10. ЗАГРУЗКА ПУБЛИКАЦИЙ
===================================== */

async function loadPosts() {

  if (!currentUser) return;

  const { data, error } = await db

    .from("posts")

    .select(`
      *,
      profiles!posts_user_id_fkey(username),
      likes(user_id)
    `)

    .order("created_at", {
      ascending: false
    });

  if (error) {

    console.error("Ошибка загрузки:", error);

    alert(error.message);

    return;

  }

  const container = document.getElementById("posts");

  container.replaceChildren();

  data.forEach(post => {

    const liked = post.likes.some(
      like => like.user_id === currentUser.id
    );

    const card = document.createElement("article");

    card.className = "post";

    // ИМЯ АВТОРА

    const author = document.createElement("strong");

    author.textContent =
      post.profiles?.username || "Пользователь";

    // ДАТА

    const date = document.createElement("p");

    date.className = "post-info";

    date.textContent = new Date(
      post.created_at
    ).toLocaleString("ru-RU");

    // ТЕКСТ

    const text = document.createElement("p");

    text.textContent = post.content || "";

    card.append(author, date, text);

    // ФОТОГРАФИЯ

    if (post.image_url) {

      const img = document.createElement("img");

      img.src = post.image_url;

      img.alt = "Фотография публикации";

      card.append(img);

    }

    // КНОПКА ЛАЙКА

    const likeButton = document.createElement("button");

    likeButton.className = "like";

    likeButton.textContent =
      `${liked ? "❤️" : "♡"} ${post.likes.length}`;

    likeButton.onclick = () => toggleLike(post, liked);

    card.append(likeButton);

    // УДАЛЕНИЕ СВОЕЙ ПУБЛИКАЦИИ

    if (post.user_id === currentUser.id) {

      const deleteButton = document.createElement("button");

      deleteButton.textContent = "Удалить";

      deleteButton.onclick = () => deletePost(post.id);

      card.append(deleteButton);

    }

    container.append(card);

  });

}


/* =====================================
   11. ЛАЙКИ
===================================== */

async function toggleLike(post, liked) {

  if (!currentUser) return;

  let result;

  if (liked) {

    result = await db
      .from("likes")
      .delete()
      .eq("post_id", post.id)
      .eq("user_id", currentUser.id);

  } else {

    result = await db
      .from("likes")
      .insert({

        post_id: post.id,

        user_id: currentUser.id

      });

  }

  if (result.error) {

    alert(result.error.message);

    return;

  }

  await loadPosts();

}


/* =====================================
   12. УДАЛЕНИЕ ПУБЛИКАЦИИ
===================================== */

async function deletePost(id) {

  if (!confirm("Удалить публикацию?")) return;

  const { error } = await db
    .from("posts")
    .delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {

    alert(error.message);

    return;

  }

  await loadPosts();

}


/* =====================================
   13. АВТОРИЗАЦИЯ
===================================== */

db.auth.onAuthStateChange((_event, session) => {

  currentUser = session?.user || null;

  showPage();

});


/* =====================================
   14. ЗАПУСК
===================================== */

checkUser();
