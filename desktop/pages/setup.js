const TEXT = {
  ar: {
    title: "مرحباً بك في منصة مشاريع AFMI",
    intro: "اكتب عنوان منصة الجمعية مرة واحدة فقط. سيتذكره البرنامج.",
    label: "عنوان المنصة",
    save: "متابعة",
    hint: "تجد العنوان عند مسؤول المنصة. يمكن تغييره لاحقاً من قائمة «البرنامج».",
    invalid: "العنوان غير صالح. يجب أن يبدأ بـ https://",
    unreachable: "تعذّر الوصول إلى المنصة. تحقق من العنوان ومن اتصالك بالإنترنت.",
  },
  fr: {
    title: "Bienvenue sur Projets AFMI",
    intro: "Saisissez une seule fois l'adresse de la plateforme de l'association. L'application s'en souviendra.",
    label: "Adresse de la plateforme",
    save: "Continuer",
    hint: "Demandez l'adresse à l'administrateur. Vous pourrez la changer dans le menu « Application ».",
    invalid: "Adresse invalide. Elle doit commencer par https://",
    unreachable: "Plateforme injoignable. Vérifiez l'adresse et votre connexion Internet.",
  },
};

(async () => {
  const lang = await window.afmi.language();
  const t = TEXT[lang] || TEXT.ar;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  for (const id of ["title", "intro", "label", "save", "hint"]) document.getElementById(id).textContent = t[id];
  const input = document.getElementById("url");
  input.value = (await window.afmi.currentUrl()) || "";
  input.focus();
  document.getElementById("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("save");
    const err = document.getElementById("error");
    btn.disabled = true;
    err.textContent = "";
    const res = await window.afmi.saveUrl(input.value);
    if (!res.ok) {
      err.textContent = t[res.error] || t.unreachable;
      btn.disabled = false;
    }
  });
})();
