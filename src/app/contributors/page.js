"use client";

import Image from 'next/image';
import Link from 'next/link';
import './contributors.css';

const contributors = [
  { name: 'Farhad Lafarie', role: 'Developer', uow: '', iit: '', img: '/contributors/farhad.png', head: '/contributors/farhadhead.png', href: 'https://www.linkedin.com/in/farhad-lafarie/' },
  { name: 'Nisla Razik', role: 'Developer', uow: '', iit: '', img: '/contributors/nisla.png', head: '/contributors/nislahead.png', href: 'https://www.linkedin.com/in/nisla-razik-084a8615b?originalSubdomain=lk' },
];

function ContributorCard({ c }) {
  return (
    <Link href={c.href} target="_blank" rel="noopener noreferrer">
      <div className="flip-card">
        <div className="flip-card-inner">
          <div className="flip-card-front">
            <div className="student">
              <Image src={c.head} alt={`${c.name} head`} className="head-image" width={240} height={240} />
              <Image src={c.img} alt={`${c.name} person`} className="person-image" width={240} height={240} />
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
    <div className="min-h-screen bg-[#2C2D31] text-white">
      <section id="details">
        <div className="title">
          <div>
            meet our <strong style={{ color: '#D3AF42' }}>team!</strong>
          </div>
          <div className="subtitle">hover to see the details</div>
        </div>

        <div className="student-details">
          {contributors.map((c) => (
            <ContributorCard key={c.name} c={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
