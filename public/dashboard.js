const currentUser = localStorage.getItem("currentUser");

if (currentUser) {
    window.location.href = "dashboard.html";
}

const currentUser = localStorage.getItem("currentUser");

document.getElementById("welcome-message").textContent =
    `Welcome back, ${currentUser}!`;