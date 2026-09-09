document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupContainer = document.getElementById("signup-container");
  const messageDiv = document.getElementById("message");
  const authButton = document.getElementById("auth-button");
  const authPanel = document.getElementById("auth-panel");
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");
  const authStatus = document.getElementById("auth-status");
  const authMessage = document.getElementById("auth-message");
  const toolsButton = document.getElementById("tools-button");
  const toolsPanel = document.getElementById("tools-panel");
  const refreshButton = document.getElementById("refresh-button");
  const availableOnlyButton = document.getElementById("available-only-button");
  const resetFormButton = document.getElementById("reset-form-button");
  let isTeacher = false;
  let showAvailableOnly = false;

  function renderAuthState(username = "") {
    signupContainer.classList.toggle("hidden", !isTeacher);
    loginForm.classList.toggle("hidden", isTeacher);
    logoutButton.classList.toggle("hidden", !isTeacher);
    authStatus.textContent = isTeacher ? `Logged in as ${username}` : "Teacher login";

    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.classList.toggle("hidden", !isTeacher);
    });
  }

  async function fetchAuthState() {
    const response = await fetch("/auth/me");
    const auth = await response.json();
    isTeacher = auth.authenticated;
    renderAuthState(auth.username || "");
  }

  function showAuthMessage(message, isError = false) {
    authMessage.textContent = message;
    authMessage.className = `auth-message ${isError ? "error" : "success"}`;
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        if (showAvailableOnly && spotsLeft <= 0) {
          return;
        }

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn ${isTeacher ? "" : "hidden"}" data-activity="${name}" data-email="${email}" aria-label="Unregister ${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      if (!activitiesList.children.length) {
        activitiesList.innerHTML = "<p><em>No activities have open spots.</em></p>";
      }

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password"),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        showAuthMessage(result.detail || "Unable to log in", true);
        return;
      }

      isTeacher = true;
      loginForm.reset();
      showAuthMessage("Teacher access enabled");
      renderAuthState(result.username);
      fetchActivities();
    } catch (error) {
      showAuthMessage("Failed to log in. Please try again.", true);
      console.error("Error logging in:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    await fetch("/auth/logout", { method: "POST" });
    isTeacher = false;
    renderAuthState();
    showAuthMessage("Logged out");
    authPanel.classList.add("hidden");
    authButton.setAttribute("aria-expanded", "false");
    fetchActivities();
  });

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  toolsButton.addEventListener("click", () => {
    const isOpen = !toolsPanel.classList.contains("hidden");
    toolsPanel.classList.toggle("hidden", isOpen);
    toolsButton.setAttribute("aria-expanded", String(!isOpen));
  });

  authButton.addEventListener("click", () => {
    const isOpen = !authPanel.classList.contains("hidden");
    authPanel.classList.toggle("hidden", isOpen);
    authButton.setAttribute("aria-expanded", String(!isOpen));
  });

  refreshButton.addEventListener("click", () => {
    toolsPanel.classList.add("hidden");
    toolsButton.setAttribute("aria-expanded", "false");
    fetchActivities();
  });

  availableOnlyButton.addEventListener("click", () => {
    showAvailableOnly = !showAvailableOnly;
    availableOnlyButton.textContent = showAvailableOnly
      ? "✓ Show all activities"
      : "✓ Show available only";
    toolsPanel.classList.add("hidden");
    toolsButton.setAttribute("aria-expanded", "false");
    fetchActivities();
  });

  resetFormButton.addEventListener("click", () => {
    signupForm.reset();
    messageDiv.className = "hidden";
    toolsPanel.classList.add("hidden");
    toolsButton.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".tools-menu")) {
      toolsPanel.classList.add("hidden");
      toolsButton.setAttribute("aria-expanded", "false");
    }
    if (!event.target.closest(".auth-menu")) {
      authPanel.classList.add("hidden");
      authButton.setAttribute("aria-expanded", "false");
    }
  });

  // Initialize app
  fetchAuthState().then(fetchActivities).catch((error) => {
    console.error("Error checking authentication:", error);
    fetchActivities();
  });
});
