const TEXT = {
  ar: { title: "لا يوجد اتصال", body: "تعذّر الوصول إلى المنصة. تحقق من اتصالك بالإنترنت ثم أعد المحاولة.", retry: "إعادة المحاولة" },
  fr: { title: "Pas de connexion", body: "Impossible de joindre la plateforme. Vérifiez votre connexion Internet puis réessayez.", retry: "Réessayer" },
};
(async () => {
  const lang = await window.afmi.language();
  const t = TEXT[lang] || TEXT.ar;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  for (const id of ["title", "body", "retry"]) document.getElementById(id).textContent = t[id];
  document.getElementById("retry").addEventListener("click", () => window.afmi.retry());
})();
