import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
const { SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,GMAIL_ADDRESS,GMAIL_APP_PASSWORD }=process.env as Record<string,string>;
const supabase=createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const MAP:Record<string,{filename:string}> = {
  sfx:{filename:'SFX.zip'},};
export default async function handler(req:VercelRequest,res:VercelResponse){
 if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
 const {email,resource}=req.body||{}; if(!email||!resource||!MAP[resource]) return res.status(400).json({error:'Invalid payload'});
 await supabase.from('resource_requests').insert({email,resource_slug:resource});
 const {data:signed,error}=await supabase.storage.from('resources').createSignedUrl(MAP[resource].filename,3600);
 if(error||!signed?.signedUrl) return res.status(500).json({error:'Failed to sign url'});
 const transporter=nodemailer.createTransport({service:'gmail',auth:{user:GMAIL_ADDRESS,pass:GMAIL_APP_PASSWORD}});
 await transporter.sendMail({from:`"Janko Visuals" <${GMAIL_ADDRESS}>`,to:email,subject:'Tvoj resurs',html:`<a href="${signed.signedUrl}">Preuzmi</a>`});
 res.status(200).json({ok:true});
}
