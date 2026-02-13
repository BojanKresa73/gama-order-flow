import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Phone, ArrowLeft, Heart } from "lucide-react";
import gamaLogo from "@/assets/gama-united-logo.svg";

const SretenjeNewsletter = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0c1445] via-[#1a2366] to-[#2a1a5e] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        
        {/* Floating stars */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/40 rounded-full animate-pulse"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-2xl w-full">
        {/* Back button */}
        <Button
          variant="ghost"
          className="text-white/70 hover:text-white hover:bg-white/10 mb-4"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Nazad
        </Button>

        {/* Main card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
          
          {/* Top ribbon - Serbian flag colors */}
          <div className="flex h-3">
            <div className="flex-1 bg-[#C6363C]" />
            <div className="flex-1 bg-[#0C4076]" />
            <div className="flex-1 bg-white" />
          </div>

          {/* Header with coat of arms feel */}
          <div className="relative px-6 md:px-10 pt-8 pb-6 text-center">
            {/* Serbian flag emoji & decorative elements */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="text-4xl">🇷🇸</span>
              <div className="h-px w-16 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <span className="text-3xl">⚜️</span>
              <div className="h-px w-16 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <span className="text-4xl">🇷🇸</span>
            </div>

            {/* Holiday title */}
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">
              Срeтење Господње
            </h1>
            <p className="text-lg md:text-xl text-amber-300 font-semibold">
              Дан државности Србије
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="h-px w-12 bg-amber-400/50" />
              <span className="text-amber-400 text-sm">15. фебруар</span>
              <div className="h-px w-12 bg-amber-400/50" />
            </div>
          </div>

          {/* Divider */}
          <div className="mx-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Main content */}
          <div className="px-6 md:px-10 py-8 text-center space-y-6">
            {/* Logo */}
            <div className="flex justify-center">
              <div className="bg-white rounded-2xl p-4 px-6 shadow-lg shadow-black/20">
                <img src={gamaLogo} alt="Gama United" className="h-12 md:h-16" />
              </div>
            </div>

            {/* Message */}
            <div className="space-y-4">
              <p className="text-white/90 text-lg md:text-xl leading-relaxed">
                Поштовани клијенти и партнери,
              </p>
              <p className="text-white/80 text-base md:text-lg leading-relaxed">
                Обавештавамо Вас да поводом празника{" "}
                <span className="text-amber-300 font-semibold">Сретења</span>{" "}
                — Дана државности Републике Србије,
                наша компанија <span className="text-white font-semibold">неће радити</span> у периоду:
              </p>

              {/* Date highlight */}
              <div className="bg-white/10 border border-white/20 rounded-2xl p-6 my-6 backdrop-blur-sm">
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  <div className="text-center">
                    <div className="text-4xl md:text-5xl font-bold text-white">16.</div>
                    <div className="text-sm text-white/60 uppercase tracking-wider">фебруар</div>
                  </div>
                  <div className="text-white/40 text-2xl">—</div>
                  <div className="text-center">
                    <div className="text-4xl md:text-5xl font-bold text-white">17.</div>
                    <div className="text-sm text-white/60 uppercase tracking-wider">фебруар</div>
                  </div>
                  <div className="text-white/40 text-2xl ml-2">
                    <span className="text-lg text-amber-300/80">2026.</span>
                  </div>
                </div>
                <p className="text-white/50 text-sm mt-3">недеља и понедељак</p>
              </div>

              <p className="text-white/80 text-base md:text-lg leading-relaxed">
                Редован рад настављамо у <span className="text-white font-semibold">уторак, 18. фебруара</span>.
              </p>
            </div>

            {/* Emergency contact */}
            <div className="bg-gradient-to-r from-[#C6363C]/20 via-[#C6363C]/30 to-[#C6363C]/20 border border-[#C6363C]/30 rounded-2xl p-5 mt-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Phone className="h-5 w-5 text-red-300 animate-pulse" />
                <p className="text-red-200 font-semibold text-base">
                  За хитне случајеве
                </p>
              </div>
              <a
                href="tel:063237226"
                className="text-2xl md:text-3xl font-bold text-white hover:text-amber-300 transition-colors tracking-wider"
              >
                063 / 237 - 226
              </a>
            </div>

            {/* Warm wishes */}
            <div className="pt-4 space-y-2">
              <p className="text-white/70 text-base italic">
                Желимо Вам срећан празник!
              </p>
              <div className="flex items-center justify-center gap-1">
                <Heart className="h-4 w-4 text-red-400 fill-red-400" />
                <span className="text-white/50 text-sm">Ваш тим — Gama United</span>
                <Heart className="h-4 w-4 text-red-400 fill-red-400" />
              </div>
            </div>
          </div>

          {/* Bottom ribbon - Serbian flag colors */}
          <div className="flex h-3">
            <div className="flex-1 bg-[#C6363C]" />
            <div className="flex-1 bg-[#0C4076]" />
            <div className="flex-1 bg-white" />
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/30 text-xs mt-6">
          © 2026 Gama United · Veljka Milićevića 2/10, 11000 Beograd
        </p>
      </div>
    </div>
  );
};

export default SretenjeNewsletter;
