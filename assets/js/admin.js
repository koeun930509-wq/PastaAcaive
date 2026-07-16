async function isAdminLoggedIn() {
  const { data } = await supabaseClient.auth.getSession();
  return !!data.session;
}

function initAdminNav(navId) {
  const nav = document.getElementById(navId);
  if (!nav) return;

  async function render() {
    const loggedIn = await isAdminLoggedIn();
    nav.textContent = loggedIn ? "로그아웃" : "관리자";
    nav.onclick = loggedIn
      ? async (e) => {
          e.preventDefault();
          await supabaseClient.auth.signOut();
          window.location.reload();
        }
      : null;
    if (!loggedIn) nav.href = "admin-login.html";
  }

  render();
}
