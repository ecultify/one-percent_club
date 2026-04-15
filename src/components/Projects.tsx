"use client";

import { motion } from "framer-motion";

export default function Projects() {
  const projects = [
    {
      title: "Neon Genesis",
      category: "WebGL / React",
      description: "Immersive 3D e-commerce experience.",
      image: "linear-gradient(to bottom right, #3f3f46, #18181b)",
    },
    {
      title: "Aura Architecture",
      category: "Next.js / GSAP",
      description: "Interactive portfolio for an architecture firm.",
      image: "linear-gradient(to right, #1e1b4b, #09090b)",
    },
    {
      title: "Flow State",
      category: "Framer Motion / Tailwind",
      description: "Fintech dashboard with seamless micro-interactions.",
      image: "linear-gradient(to top right, #064e3b, #020617)",
    },
    {
      title: "Lunar Sync",
      category: "React Native",
      description: "Cross-platform mobile app for moon phase tracking.",
      image: "linear-gradient(to bottom, #4c1d95, #000000)",
    }
  ];

  return (
    <section className="relative z-20 w-full min-h-screen bg-[#121212] py-32 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="mb-20"
        >
          <h2 className="text-4xl md:text-7xl font-medium tracking-tight text-white">
            Selected Work
          </h2>
          <p className="mt-4 text-xl text-gray-400 font-light max-w-2xl">
            A collection of digital experiences focusing on motion, interaction, and aesthetics.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {projects.map((project, idx) => (
            <motion.div
              key={project.title}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
              className="group relative cursor-pointer"
            >
              <div 
                className="w-full aspect-[4/3] rounded-3xl overflow-hidden mb-6 transition-transform duration-700 group-hover:scale-[1.02]"
                style={{ background: project.image }}
              >
                {/* 
                  A glassmorphism overlay on hover 
                */}
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-500 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 flex items-center justify-center">
                  <span className="text-white bg-white/10 px-6 py-3 rounded-full border border-white/20 backdrop-blur-md uppercase tracking-wider text-sm font-medium">
                    View Case Study
                  </span>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">{project.category}</p>
                <h3 className="text-2xl font-normal text-white mb-2">{project.title}</h3>
                <p className="text-gray-400 font-light">{project.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
