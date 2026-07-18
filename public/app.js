console.log("GymPact JavaScript loaded!");

const userCards = document.querySelectorAll(".user-card");


userCards.forEach(card => {

    card.addEventListener("click", () => {

        const selectedUser = card.dataset.user;

        localStorage.setItem("currentUser", selectedUser);

        console.log(`Saved user: ${selectedUser}`);

    });

});