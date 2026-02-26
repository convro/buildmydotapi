import { promises as fs } from 'fs';
import { join }          from 'path';
import os                from 'os';

const VBS_DIR       = join(os.homedir(), '.vbs');
const REGISTRY_PATH = join(VBS_DIR, 'projects.json');

async function ensureDir() {
  await fs.mkdir(VBS_DIR, { recursive: true });
}

async function load() {
  try {
    return JSON.parse(await fs.readFile(REGISTRY_PATH, 'utf8'));
  } catch {
    return { projects: [] };
  }
}

async function save(reg) {
  await ensureDir();
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(reg, null, 2), 'utf8');
}

export async function registerProject(entry) {
  const reg = await load();
  reg.projects = reg.projects.filter(p => p.name !== entry.name);
  reg.projects.unshift(entry);
  await save(reg);
}

export async function listProjects() {
  return (await load()).projects;
}

export async function findProject(name) {
  const reg = await load();
  return reg.projects.find(p => p.name === name) || null;
}

export async function removeProject(name) {
  const reg = await load();
  reg.projects = reg.projects.filter(p => p.name !== name);
  await save(reg);
}
