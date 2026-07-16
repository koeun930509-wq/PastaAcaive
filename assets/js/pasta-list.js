const PASTA_LIST_PAGE_SIZE = 10;

function pastaListEscapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function pastaListStarsHtml(star) {
  const filledCount = Number(star) || 0;
  let html = "";
  for (let i = 1; i <= 5; i++) {
    const cls = i <= filledCount ? "text-accentdark" : "text-border";
    html += `<svg class="w-3 h-3 md:w-3.5 md:h-3.5 ${cls}"><use href="#icon-star" /></svg>`;
  }
  return html;
}

function pastaListCardHtml(row, detailPage, writePage, isAdmin) {
  const img = pastaListEscapeHtml(row.thumbnail_url || "assets/img/크림파스타-배너.png");
  const name = pastaListEscapeHtml(row.pasta_name);
  const adminControls = isAdmin
    ? `
      <p class="flex items-center gap-2 mt-1">
        <button type="button" data-edit-id="${row.id}" class="text-[11px] text-inksub hover:text-accentdark">수정</button>
        <button type="button" data-delete-id="${row.id}" class="text-[11px] text-inksub hover:text-red-600">삭제</button>
      </p>
    `
    : "";
  return `
    <a href="${detailPage}?id=${row.id}" class="group">
      <div class="rounded-xl overflow-hidden border border-border mb-3">
        <img src="${img}" alt="${name}" class="w-full aspect-[3/4] object-cover group-hover:scale-105 transition-transform duration-300" />
      </div>
      <p class="text-xs md:text-sm font-medium truncate">${name}</p>
      <p class="flex items-center gap-0.5 mt-0.5">${pastaListStarsHtml(row.star)}</p>
      ${adminControls}
    </a>
  `;
}

function pastaListPagingHtml(page, totalPages) {
  let start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  start = Math.max(1, end - 4);

  let html = `<button data-page="prev" class="w-9 h-9 flex items-center justify-center rounded-lg text-inkmute hover:text-ink disabled:opacity-40 disabled:pointer-events-none" aria-label="이전 페이지" ${page <= 1 ? "disabled" : ""}>
    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6" /></svg>
  </button>`;

  for (let p = start; p <= end; p++) {
    const active = p === page;
    html += `<button data-page="${p}" class="w-9 h-9 flex items-center justify-center rounded-lg ${active ? "bg-ink text-white" : "text-inksub hover:text-ink"} text-sm font-medium" ${active ? 'aria-current="page"' : ""}>${p}</button>`;
  }

  html += `<button data-page="next" class="w-9 h-9 flex items-center justify-center rounded-lg text-inkmute hover:text-ink disabled:opacity-40 disabled:pointer-events-none" aria-label="다음 페이지" ${page >= totalPages ? "disabled" : ""}>
    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6" /></svg>
  </button>`;

  return html;
}

function initPastaList(type, detailPage, writePage) {
  const grid = document.getElementById("cardGrid");
  const paging = document.getElementById("pagingNav");
  if (!grid || !paging) return;

  let currentPage = 1;

  async function loadPage(page) {
    grid.innerHTML = `<p class="col-span-3 md:col-span-6 text-center text-sm text-inkmute py-10">불러오는 중...</p>`;
    paging.innerHTML = "";

    const isAdmin = await isAdminLoggedIn();
    const from = (page - 1) * PASTA_LIST_PAGE_SIZE;
    const to = from + PASTA_LIST_PAGE_SIZE - 1;

    const { data, count, error } = await supabaseClient
      .from("pasta_view")
      .select("*", { count: "exact" })
      .eq("type", type)
      .order("id", { ascending: false })
      .range(from, to);

    if (error) {
      grid.innerHTML = `<p class="col-span-3 md:col-span-6 text-center text-sm text-inkmute py-10">목록을 불러오지 못했습니다.</p>`;
      return;
    }

    if (!data || data.length === 0) {
      grid.innerHTML = `<p class="col-span-3 md:col-span-6 text-center text-sm text-inkmute py-10">등록된 레시피가 없습니다.</p>`;
      return;
    }

    grid.innerHTML = data.map((row) => pastaListCardHtml(row, detailPage, writePage, isAdmin)).join("");

    if (isAdmin) {
      grid.querySelectorAll("button[data-edit-id]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = `${writePage}?id=${btn.dataset.editId}`;
        });
      });

      grid.querySelectorAll("button[data-delete-id]").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!confirm("이 글을 삭제하시겠습니까?")) return;

          const { error: deleteError } = await supabaseClient.from("pasta_view").delete().eq("id", btn.dataset.deleteId);
          if (deleteError) {
            alert("삭제에 실패했습니다: " + deleteError.message);
            return;
          }
          loadPage(currentPage);
        });
      });
    }

    const totalPages = Math.max(1, Math.ceil((count || 0) / PASTA_LIST_PAGE_SIZE));
    currentPage = page;
    paging.innerHTML = pastaListPagingHtml(currentPage, totalPages);

    paging.querySelectorAll("button[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.page;
        const nextPage = val === "prev" ? currentPage - 1 : val === "next" ? currentPage + 1 : Number(val);
        if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) return;
        loadPage(nextPage);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  loadPage(1);
}
