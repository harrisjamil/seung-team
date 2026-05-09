import Script from "next/script";

const INIT = `(function(){try{var k="fleet-theme";var s=localStorage.getItem(k);var dark=s==="dark"?true:s==="light"?false:window.matchMedia("(prefers-color-scheme:dark)").matches;if(dark)document.documentElement.classList.add("dark");else document.documentElement.classList.remove("dark");}catch(e){}})();`;

/** Avoid theme flash — runs before paint (with next/script beforeInteractive). */
export function FleetThemeScript() {
  return (
    <Script id="fleet-theme-init" strategy="beforeInteractive">
      {INIT}
    </Script>
  );
}
