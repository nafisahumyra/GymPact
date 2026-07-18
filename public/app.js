const currentUser = localStorage.getItem("currentUser");

if (currentUser) {
    window.location.href = "dashboard.html";
}


const userCards = document.querySelectorAll(".user-card");


userCards.forEach(card => {

    card.addEventListener("click", () => {

        const selectedUser = card.dataset.user;

        localStorage.setItem("currentUser", selectedUser);

        console.log(`Saved user: ${selectedUser}`);

        window.location.href = "dashboard.html";

    });

});