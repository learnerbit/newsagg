export const dynamic = 'force-dynamic';

import { sql } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { auth, signIn, signOut } from "@/src/auth";


export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ bias?: string; q?: string }>;
}) {
  // 1. Get URL Params & User Session
  const { bias, q } = await searchParams;
  const session = await auth();
  const isAdmin = session?.user?.role === 'admin';

  // 2. Fetch Data (Outlets, Counts, and Filtered Articles)
  const outlets = await sql`SELECT * FROM outlets ORDER BY name ASC`;
  
  const counts = await sql`
    SELECT bias_label, COUNT(*) as total 
    FROM articles 
    JOIN outlets ON articles.outlet_id = outlets.id 
    GROUP BY bias_label
  `;

  const getCount = (label: string) => 
    counts.find(c => c.bias_label === label)?.total || 0;
  
  const totalArticles = await sql`SELECT COUNT(*) FROM articles`;

  const articles = await sql`
    SELECT articles.*, outlets.name AS outlet_name, outlets.bias_label AS outlet_bias
    FROM articles
    JOIN outlets ON articles.outlet_id = outlets.id
    WHERE 
      (${bias ? sql`outlets.bias_label = ${bias}` : sql`TRUE`})
      AND 
      (${q ? sql`articles.title ILIKE ${'%' + q + '%'}` : sql`TRUE`})
    ORDER BY articles.created_at DESC
  `;

  // 3. Server Actions (Backend Logic)
  async function addArticle(formData: FormData) {
    'use server';
    const session = await auth();
    if (session?.user?.role !== 'admin') return; // Only Admin can Add

    await sql`
      INSERT INTO articles (title, url, summary, outlet_id, category)
      VALUES (
        ${formData.get('title') as string}, 
        ${formData.get('url') as string}, 
        ${formData.get('summary') as string}, 
        ${Number(formData.get('outlet_id'))}, 
        ${formData.get('category') as string}
      )
    `;
    revalidatePath('/');
  }

  async function deleteArticle(formData: FormData) {
    'use server';
    const session = await auth();
    if (session?.user?.role !== 'admin') return; // Only Admin can Delete

    await sql`DELETE FROM articles WHERE id = ${Number(formData.get('id'))}`;
    revalidatePath('/');
  }

  // 4. The UI (Frontend)
  return (
    <main className="p-6 md:p-10 font-sans max-w-6xl mx-auto bg-gray-50 min-h-screen">
      
      {/* 🔐 Auth Header */}
      <div className="flex justify-end items-center gap-4 mb-8">
        {session ? (
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-slate-600">
              Hello, {session.user?.name} | Role: {session.user?.role} | Email: {session.user?.email} <span className="text-[10px] bg-slate-200 px-1 rounded uppercase">{session.user?.role}</span>
            </p>
            <form action={async () => { "use server"; await signOut(); }}>
              <button className="text-xs text-red-500 font-bold border border-red-200 px-3 py-1 rounded-full hover:bg-red-50">Sign Out</button>
            </form>
          </div>
        ) : (
          <form action={async () => { "use server"; await signIn("google"); }}>
            <button className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 transition">
              <img src="https://authjs.dev/img/providers/google.svg" width="16" alt="G" />
              Sign in with Google
            </button>
          </form>
        )}
      </div>

      <header className="mb-12 text-center">
        <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase">News Observer</h1>
        
        {/* 🔍 Search */}
        <form className="mt-8 max-w-lg mx-auto flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search headlines..." className="flex-1 p-3 border rounded-full shadow-inner outline-none focus:ring-2 focus:ring-blue-500" />
          <button className="bg-slate-900 text-white px-8 rounded-full font-bold hover:bg-slate-800 transition">Search</button>
        </form>

        {/* 🎨 Updated Bias Filters */}
        <div className="flex flex-wrap justify-center gap-2 mt-8">
          {['Left', 'Center', 'Right', 'Unknown'].map(label => (
            <Link 
              key={label} 
              href={`/?bias=${label}`} 
              className={`px-5 py-2 rounded-full text-sm font-bold border transition ${
                bias === label ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {label} ({getCount(label)})
            </Link>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        {/* ✍️ Sidebar: Admin Only Submission Form */}
        <aside className="lg:col-span-1">
          {isAdmin ? (
            <section className="p-6 bg-white rounded-3xl shadow-sm border border-slate-200 sticky top-10">
              <h2 className="font-black text-slate-800 mb-4 text-lg">Admin Tools</h2>
              <form action={addArticle} className="space-y-4">
                <input name="title" placeholder="Headine" className="w-full p-2 text-sm border rounded-lg bg-slate-50" required />
                <input name="url" placeholder="URL" className="w-full p-2 text-sm border rounded-lg bg-slate-50" required />
                <input name="category" placeholder="Category" className="w-full p-2 text-sm border rounded-lg bg-slate-50" required />
                <select name="outlet_id" className="w-full p-2 text-sm border rounded-lg bg-slate-50" required>
                  {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <textarea name="summary" placeholder="Summary..." className="w-full p-2 text-sm border rounded-lg bg-slate-50" rows={3} required />
                <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:shadow-lg transition">Post Article</button>
              </form>
            </section>
          ) : (
            <div className="p-6 bg-slate-100 rounded-3xl border-2 border-dashed border-slate-200 text-center">
              <p className="text-slate-400 text-sm font-medium">Log in as Admin to post or manage news.</p>
            </div>
          )}
        </aside>

        {/* 🗞️ Main Feed */}
        <section className="lg:col-span-3 space-y-6">
          <div className="flex justify-between border-b border-slate-200 pb-2">
            <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">
              {q ? `Search: ${q}` : bias ? `${bias} Perspective` : "Global Feed"}
            </h2>
          </div>

          {articles.map((article) => (
            <article key={article.id} className="group p-8 border rounded-3xl bg-white shadow-sm hover:shadow-md border-slate-200 transition-all">
               <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${
                      article.outlet_bias === 'Left' ? 'bg-blue-500' :
                      article.outlet_bias === 'Right' ? 'bg-red-500' :
                      article.outlet_bias === 'Center' ? 'bg-emerald-500' :
                      'bg-slate-300' // Default color for 'Unknown'
                    }`}></span>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tighter">{article.outlet_name}</span>
                    <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded uppercase">{article.category}</span>
                  </div>
                  
                  {/* 👇 Ensure this 'isAdmin' check matches the variable at the top of Home() */}
                    {isAdmin && (
                      <form action={deleteArticle}>
                        <input type="hidden" name="id" value={article.id} />
                        <button className="text-slate-300 hover:text-red-500 transition-colors p-1">
                          ✕
                        </button>
                      </form>
                    )}
                </div>

              <h3 className="text-2xl font-bold text-slate-900 mb-3 leading-tight">{article.title}</h3>
              <p className="text-slate-600 leading-relaxed mb-6">{article.summary}</p>
              <a href={article.url} target="_blank" className="inline-flex items-center text-blue-600 font-bold hover:gap-2 transition-all">
                Read Full Report <span className="ml-1">→</span>
              </a>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}