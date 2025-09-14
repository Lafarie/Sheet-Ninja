"use client";

import Image from "next/image";
import Link from "next/link";
import "./contributors.css";

const contributors = [
  { name: "Farhad Lafarie", role: "Developer", uow: "", iit: "", img: "/contributors/farhad.png", head: "/contributors/farhadhead.png", href: "https://www.linkedin.com/in/farhad-lafarie/" },
  { name: "Nisla Razik", role: "Developer", uow: "", iit: "", img: "/contributors/nisla.png", head: "/contributors/nislahead.png", href: "https://www.linkedin.com/in/nisla-razik-084a8615b?originalSubdomain=lk" },
];

function ContributorCard({ c }) {
  return (
    <Link href={c.href} target="_blank" rel="noopener noreferrer">
      <div className="flip-card">
        <div className="flip-card-inner">
          <div className="flip-card-front">
            <div className="student">
              <Image src={c.head} alt={`${c.name}`} className="head-image" width={240} height={240} />
              <Image src={c.img} alt={`${c.name}`} className="person-image" width={240} height={240} />
              <Image src="/contributors/bgcover.png" alt="circle Image" className="circle-image" width={240} height={240} />
              <Image src="/contributors/bgcover.png" alt="bg Image" className="bg-image" width={240} height={240} />
            </div>
          </div>
          <div className="flip-card-back">
            <h1>{c.name}</h1>
            <h3>{c.role}</h3>
            <br />
            {/* <h4>UoW : {c.uow}</h4>
            <h4>IIT : {c.iit}</h4> */}
            <br />
            {/* <div className="button">Click To See Page Editor</div> */}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ContributorsPage() {
  return (
    <div className="min-h-screen bg-[#2C2D31] text-white pt-20">
      <div className="w-full px-4 mt-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center md:justify-start mb-4">
            <Link href="/setup" className="inline-flex items-center gap-2 px-3 py-1.5 bg-transparent border border-gray-600 text-gray-200 rounded hover:bg-gray-700 transition">
              ← Back to setup
            </Link>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-6xl font-semibold uppercase text-white drop-shadow-md">
              meet our <strong className="text-[#D3AF42]">team!</strong>
            </div>
            <div className="mt-4 text-sm md:text-lg tracking-wide text-gray-200">hover to see the details</div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center items-start gap-10 pt-10 px-4">
        {contributors.map((c) => (
          <ContributorCard key={c.name} c={c} />
        ))}
      </div>
    </div>
  );
}
