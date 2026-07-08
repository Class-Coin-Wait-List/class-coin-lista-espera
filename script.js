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
  WHATSAPP_GROUP_URL: "https://chat.whatsapp.com/COLE_SEU_LINK_AQUI",
  WHATSAPP_NUMBER: "",          // ex.: "5511999999999" (usado só se GROUP_URL ficar vazio)
  LEAD_ENDPOINT: "https://script.google.com/macros/s/AKfycbwW5i5BCh06am9Z3V8PCseIt-RZdpVzZNwsXlHRScfco3M2jtkeJ5Y3pbx7lfyKwelDpA/exec", // Planilha Google (Apps Script)
  REDIRECT_DELAY_MS: 1500       // tempo da mensagem de sucesso antes de redirecionar
};

/* ---------- Helpers ---------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const onlyDigits = (v) => v.replace(/\D/g, "");

/* ---------- Máscara leve de WhatsApp (BR) ---------- */
function maskPhone(value) {
  const d = onlyDigits(value).slice(0, 11);
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

    // mostra sucesso
    success.hidden = false;
    success.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const url = buildWhatsAppUrl(lead);
    if (url) {
      setTimeout(() => { window.location.href = url; }, CONFIG.REDIRECT_DELAY_MS);
    } else {
      // sem WhatsApp configurado: apenas confirma o cadastro
      $(".success-sub", success).textContent = "Cadastro recebido! Em breve entraremos em contato.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Quero entrar na lista";
    }
  });
}

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
});
