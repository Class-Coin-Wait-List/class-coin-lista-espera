/* ============================================================
   Class Coin · Lista de Espera: comportamento
   ============================================================ */

/* ---------- CONFIG (edite aqui) -------------------------------
   1) WHATSAPP_GROUP_URL: cole o link do seu GRUPO ou CONVITE do
      WhatsApp. Ao se cadastrar, o lead é redirecionado para cá.
      Ex.: "https://chat.whatsapp.com/XXXXXXXXXXXXXXX"

   2) (ALTERNATIVA) Se preferir que cada lead caia direto no CHAT
      do professor (e não num grupo), deixe WHATSAPP_GROUP_URL = ""
      e preencha WHATSAPP_NUMBER com o número no formato
      internacional só com dígitos. Ex.: "5511999999999".
      Nesse caso, abrimos o wa.me com uma mensagem pré-preenchida
      contendo Nome e E-mail.

   3) (OPCIONAL) LEAD_ENDPOINT: URL que recebe um POST (JSON) com
      os dados do lead, caso você queira ARMAZENAR os cadastros
      além do redirect (ex.: Formspree, Google Apps Script, webhook).
      Deixe "" para não enviar a lugar nenhum.
--------------------------------------------------------------- */
const CONFIG = {
  WHATSAPP_GROUP_URL: "https://chat.whatsapp.com/ChyAy0wHHK011LGHVvOEhJ",
  WHATSAPP_NUMBER: "",          // ex.: "5511999999999" (usado só se GROUP_URL ficar vazio)
  LEAD_ENDPOINT: "https://script.google.com/macros/s/AKfycbwW5i5BCh06am9Z3V8PCseIt-RZdpVzZNwsXlHRScfco3M2jtkeJ5Y3pbx7lfyKwelDpA/exec", // Planilha Google (Apps Script)
  REDIRECT_DELAY_MS: 2500,      // tempo da mensagem de sucesso antes de redirecionar
  WORKSHOP_DATE: "2026-08-02T20:00:00-03:00" // data/hora da aula (Brasília)
};

/* ---------- Helpers ---------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const onlyDigits = (v) => v.replace(/\D/g, "");

/* ---------- Máscara leve de WhatsApp (BR) ---------- */
function maskPhone(value) {
  let d = onlyDigits(value);
  // preenchimento automático costuma incluir o código do país (+55);
  // só remove quando sobram dígitos além de DDD + número
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/* ---------- Validação de campos ---------- */
function setError(input, message) {
  const slot = $(`[data-error-for="${input.id}"]`);
  if (slot) slot.textContent = message || "";
  input.classList.toggle("invalid", Boolean(message));
}

function validate(form) {
  let ok = true;
  const nome = form.nome;
  const email = form.email;
  const whatsapp = form.whatsapp;

  if (!nome.value.trim() || nome.value.trim().length < 2) {
    setError(nome, "Informe seu nome.");
    ok = false;
  } else setError(nome, "");

  if (!isValidEmail(email.value)) {
    setError(email, "Informe um e-mail válido.");
    ok = false;
  } else setError(email, "");

  if (onlyDigits(whatsapp.value).length < 10) {
    setError(whatsapp, "Informe um WhatsApp válido com DDD.");
    ok = false;
  } else setError(whatsapp, "");

  return ok;
}

/* ---------- Redirecionamento para o WhatsApp ---------- */
function buildWhatsAppUrl(lead) {
  if (CONFIG.WHATSAPP_GROUP_URL && !CONFIG.WHATSAPP_GROUP_URL.includes("COLE_SEU_LINK_AQUI")) {
    return CONFIG.WHATSAPP_GROUP_URL;
  }
  if (CONFIG.WHATSAPP_NUMBER) {
    const msg = `Olá! Quero entrar na lista de espera do workshop.\nNome: ${lead.nome}\nE-mail: ${lead.email}`;
    return `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  }
  return null; // nada configurado ainda
}

/* ---------- Envio opcional do lead ---------- */
async function sendLead(lead) {
  if (!CONFIG.LEAD_ENDPOINT) return;
  try {
    // text/plain + no-cors evita o preflight de CORS que o Google Apps
    // Script não responde. É "fire-and-forget": não lemos a resposta,
    // só garantimos que o POST seja enviado antes do redirect.
    await fetch(CONFIG.LEAD_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(lead),
      keepalive: true
    });
  } catch (err) {
    console.warn("Falha ao enviar lead para LEAD_ENDPOINT:", err);
  }
}

/* ---------- Submit ---------- */
function initForm() {
  const form = $("#waitlist-form");
  if (!form) return;
  const success = $("#form-success");
  const submitBtn = $('button[type="submit"]', form);
  const phone = form.whatsapp;

  phone.addEventListener("input", (e) => {
    e.target.value = maskPhone(e.target.value);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // honeypot anti-spam
    if (form.empresa && form.empresa.value.trim() !== "") return;

    // normaliza o WhatsApp (autofill pode não disparar o evento de input)
    form.whatsapp.value = maskPhone(form.whatsapp.value);

    if (!validate(form)) {
      const firstInvalid = $(".invalid", form);
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const lead = {
      nome: form.nome.value.trim(),
      email: form.email.value.trim(),
      whatsapp: form.whatsapp.value.trim(),
      origem: "lista-espera-workshop-joao",
      data: new Date().toISOString()
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando…";

    await sendLead(lead);

    // dispara a conversão para o GTM (usado pelo Pixel da Meta: evento Lead)
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "lead_workshop" });

    // esconde os campos e mostra o estado de sucesso
    $$(".field", form).forEach((f) => { f.style.display = "none"; });
    submitBtn.style.display = "none";
    const note = $(".form-note", form);
    if (note) note.style.display = "none";
    success.hidden = false;
    success.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const url = buildWhatsAppUrl(lead);
    const waBtn = $("#whatsapp-btn");
    if (url) {
      if (waBtn) waBtn.href = url;
      setTimeout(() => { window.location.href = url; }, CONFIG.REDIRECT_DELAY_MS);
    } else {
      // sem WhatsApp configurado: apenas confirma o cadastro
      $(".success-step", success).textContent = "Cadastro recebido!";
      $(".success-sub", success).textContent = "Em breve entraremos em contato.";
      if (waBtn) waBtn.style.display = "none";
    }
  });
}

/* ---------- Contagem regressiva até a aula ---------- */
function initCountdown() {
  const box = $("#countdown");
  if (!box) return;
  const target = new Date(CONFIG.WORKSHOP_DATE).getTime();
  const slots = {
    days: $('[data-cd="days"]', box),
    hours: $('[data-cd="hours"]', box),
    minutes: $('[data-cd="minutes"]', box),
    seconds: $('[data-cd="seconds"]', box)
  };
  const pad = (n) => String(n).padStart(2, "0");

  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) {
      box.innerHTML = '<span class="countdown-label">O workshop ao vivo começou!</span>';
      clearInterval(timer);
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (slots.days) slots.days.textContent = pad(d);
    if (slots.hours) slots.hours.textContent = pad(h);
    if (slots.minutes) slots.minutes.textContent = pad(m);
    if (slots.seconds) slots.seconds.textContent = pad(s);
  }

  tick();
  const timer = setInterval(tick, 1000);
}

/* Resultados: a rolagem contínua é feita 100% em CSS (animação marquee) */

/* ---------- Scroll suave até o formulário (seção final) ---------- */
function initScrollToForm() {
  $$(".js-scroll-form").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const signup = $("#inscricao");
      if (signup) signup.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => { const n = $("#nome"); if (n) n.focus({ preventScroll: true }); }, 500);
    });
  });
}

/* ---------- Reveal on scroll ---------- */
function initReveal() {
  const els = $$(".reveal");
  if (!("IntersectionObserver" in window) || !els.length) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach((el) => io.observe(el));
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initForm();
  initScrollToForm();
  initReveal();
  initCountdown();
});
