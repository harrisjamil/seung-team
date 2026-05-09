import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBell,
  faCloudRain,
  faShip,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";

type CommandCardsProps = {
  variant?: "command" | "captain";
  shipCount: number;
  openAlertsCount: number;
  distressedCount: number;
  adverseCount: number;
};

export function CommandCards({
  variant = "command",
  shipCount,
  openAlertsCount,
  distressedCount,
  adverseCount,
}: CommandCardsProps) {
  const cards = [
    {
      id: "01",
      title: variant === "captain" ? "My vessel" : "Active Ships",
      value: shipCount,
      icon: faShip,
      hoverIcon: faShip,
      bgClass: "bg-[#d7f0ff]",
      hoverIconClass: "text-sky-500",
    },
    {
      id: "02",
      title: "Open Alerts",
      value: openAlertsCount,
      icon: faBell,
      hoverIcon: faBell,
      bgClass: "bg-[#ffe1b8]",
      hoverIconClass: "text-orange-500",
    },
    {
      id: "03",
      title: "Distressed",
      value: distressedCount,
      icon: faTriangleExclamation,
      hoverIcon: faTriangleExclamation,
      bgClass: "bg-[#ffd5d5]",
      hoverIconClass: "text-rose-500",
    },
    {
      id: "04",
      title: "Weather",
      value: adverseCount,
      icon: faCloudRain,
      hoverIcon: faCloudRain,
      bgClass: "bg-[#e8dbff]",
      hoverIconClass: "text-violet-500",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.id}
          className={`group relative overflow-hidden rounded-[1.5rem] p-4 text-slate-900 transition-transform duration-300 sm:rounded-[2rem] sm:p-6 hover:scale-[0.98] hover:sm:scale-[0.97] active:scale-95 sm:active:scale-90 dark:text-slate-100 ${card.bgClass} dark:bg-slate-800/90 dark:ring-1 dark:ring-slate-600/60`}
        >
          <div className="relative z-10 flex h-full min-h-[132px] flex-col justify-between transition-transform duration-300 group-hover:scale-[0.98] sm:min-h-[180px] sm:group-hover:scale-[0.96]">
            <div className="flex items-start justify-between">
              <span className="text-lg font-bold">{card.id}.</span>
              <p className="text-base font-semibold">{card.title}</p>
            </div>

            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Hover Me?</p>
                <p className="text-4xl font-bold leading-none">{card.value}</p>
              </div>
              <FontAwesomeIcon icon={card.icon} className="text-xl" />
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <FontAwesomeIcon
              icon={card.icon}
              className="text-6xl text-slate-900/20 transition-transform duration-300 group-hover:scale-105 dark:text-slate-100/10"
            />
            <FontAwesomeIcon
              icon={card.hoverIcon}
              className={`absolute -right-3 -top-3 text-5xl opacity-0 transition-all duration-300 group-hover:right-4 group-hover:top-4 group-hover:opacity-100 ${card.hoverIconClass}`}
            />
          </div>
        </div>
      ))}
    </section>
  );
}
