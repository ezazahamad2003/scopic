import React from "react";
import { SUGGESTION_CARDS, APP_TAGLINE } from "../utils/constants.js";

export default function WelcomeScreen({ onSuggestion }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 select-none">
      {/* Logo */}
      <div className="mb-3">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold mx-auto mb-4"
          style={{
            background: "linear-gradient(135deg, #C9A55C, #A8874A)",
            color: "#0F1117",
            boxShadow: "0 8px 32px #C9A55C33",
          }}
        >
          S
        </div>
        <h1
          className="text-4xl text-center"
          style={{ fontFamily: "DM Serif Display, serif", color: "#C9A55C" }}
        >
          Scopic
        </h1>
        <p className="text-center text-gray-400 mt-2 text-sm">{APP_TAGLINE}</p>
      </div>

      {/* Disclaimer */}
      <div
        className="text-xs text-center text-gray-500 mb-8 max-w-md px-4 py-2 rounded-lg"
        style={{ background: "#161B27", border: "1px solid #2A3347" }}
      >
        Provides legal <strong className="text-gray-400">information</strong>, not legal advice. 
        Always consult a qualified attorney for specific matters.
      </div>

      {/* Suggestion cards */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
        {SUGGESTION_CARDS.map((card) => (
          <button
            key={card.id}
            onClick={() => onSuggestion(card.prompt)}
            className="text-left p-4 rounded-xl transition-all duration-150 group"
            style={{
              background: "#161B27",
              border: "1px solid #2A3347",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.border = "1px solid #C9A55C66";
              e.currentTarget.style.background = "#1a2030";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.border = "1px solid #2A3347";
              e.currentTarget.style.background = "#161B27";
            }}
          >
            <div className="text-2xl mb-2">{card.icon}</div>
            <div
              className="text-sm font-medium mb-1 group-hover:text-[#C9A55C] transition-colors"
              style={{ color: "#D4B675" }}
            >
              {card.title}
            </div>
            <div className="text-xs text-gray-500 leading-relaxed line-clamp-2">
              {card.prompt}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
