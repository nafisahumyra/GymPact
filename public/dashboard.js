const currentUser = localStorage.getItem("currentUser");

document.getElementById("welcome-message").textContent =
    `Welcome back, ${currentUser}!`;