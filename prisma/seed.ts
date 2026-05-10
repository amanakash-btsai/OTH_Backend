import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log("Database already seeded — skipping.");
    return;
  }

  console.log("🌱 Seeding EQC database...\n");

  // ── ID LOOKUP MAPS ──────────────────────────────────────────────────────────
  const userById   = new Map<string, string>(); // USR001 → uuid
  const userByName = new Map<string, string>(); // "Porngak Suriya" → uuid
  const accById    = new Map<string, string>(); // ACC001 → uuid
  const accByName  = new Map<string, string>(); // "Buddachinarai Hospital" → uuid
  const accessById = new Map<string, string>(); // ACCY001 → uuid
  const accyByName = new Map<string, string>(); // "Light Source Cable" → uuid
  const bomById    = new Map<string, string>(); // BOM001 → uuid
  const repairByRs = new Map<string, string>(); // RS-202602-099595 → uuid
  const reqByNum   = new Map<string, string>(); // DR-2602-106504 → uuid
  const deplByNum  = new Map<string, string>(); // DR-2602-106504 → deployment uuid
  const deplByAsset= new Map<string, string>(); // serial_number → deployment uuid
  const inspByNum  = new Map<string, string>(); // INSP-001 → uuid
  const bomLineByAccessory = new Map<string, string>(); // accessory uuid → first bom_line uuid
  const assetBySerial = new Map<string, string>(); // serial → uuid
  const assetByName   = new Map<string, string>(); // asset_name (first match) → uuid

  // ── STEP 1: USERS ───────────────────────────────────────────────────────────
  console.log("1/17 Users...");
  const userRows = [
    // From users.csv
    { id: "USR001", name: "Porngak Suriya",  email: "porngak@eqc.com",    role: "Sales_Rep",    team: "Sales",      area: "North"    },
    { id: "USR002", name: "Jakkraphan W.",   email: "jakkraphan@eqc.com", role: "Sales_Rep",    team: "Sales",      area: "Central"  },
    { id: "USR003", name: "Anti Kessle",     email: "anti@eqc.com",       role: "FSE",           team: "Service",    area: "South"    },
    { id: "USR004", name: "Maria Chen",      email: "maria@eqc.com",      role: "EQC_Operator", team: "Operations", area: "SEA"      },
    { id: "USR005", name: "Rahul Mehta",     email: "rahul@eqc.com",      role: "Sales_Manager",team: "Sales",      area: "West"     },
    // Stubs for names appearing in sales_requests but not in users.csv
    { id: "USR006", name: "Ronton Josh",     email: "ronton@eqc.com",     role: "Sales_Rep",    team: "Sales",      area: "Central"  },
    { id: "USR007", name: "Preeyanan K.",    email: "preeyanan@eqc.com",  role: "Sales_Rep",    team: "Sales",      area: "Central"  },
    { id: "USR008", name: "Kanokwan S.",     email: "kanokwan@eqc.com",   role: "Sales_Rep",    team: "Sales",      area: "Central"  },
    { id: "USR009", name: "Vit Thamrong",    email: "vit@eqc.com",        role: "Sales_Rep",    team: "Sales",      area: "Central"  },
    { id: "USR010", name: "Ark Suranon",     email: "ark@eqc.com",        role: "FSE",           team: "Service",    area: "North"    },
    { id: "USR011", name: "Tee Charoensuk",  email: "tee@eqc.com",        role: "Sales_Rep",    team: "Sales",      area: "Central"  },
  ];
  for (const r of userRows) {
    const u = await prisma.user.create({
      data: { name: r.name, email: r.email, role: r.role, team: r.team, area: r.area, is_active: true },
    });
    userById.set(r.id, u.user_id);
    userByName.set(r.name, u.user_id);
  }
  console.log(`   ✓ ${userRows.length} rows`);

  // ── STEP 2: ACCOUNTS ────────────────────────────────────────────────────────
  console.log("2/17 Accounts...");
  const accountRows = [
    // From accounts.csv
    { id: "ACC001", name: "Buddachinarai Hospital",              area: "North",    seg: "Government"  },
    { id: "ACC002", name: "London Hospital",                     area: "Central",  seg: "Private"     },
    { id: "ACC003", name: "Manon Naval Hospital",                area: "South",    seg: "Military"    },
    { id: "ACC004", name: "NE Welfare Hospital",                 area: "North",    seg: "Government"  },
    { id: "ACC005", name: "Ramathibodi Hospital",                area: "Central",  seg: "University"  },
    { id: "ACC006", name: "Sakura Medical Center",               area: "East",     seg: "Private"     },
    { id: "ACC007", name: "Apollo Medics",                       area: "West",     seg: "Private"     },
    { id: "ACC008", name: "Global Care Hospital",                area: "SEA",      seg: "Corporate"   },
    // Stubs for accounts referenced elsewhere
    { id: "ACC009", name: "Thammasat University Hospital",       area: "Central",  seg: "University"  },
    { id: "ACC010", name: "Siriraj Hospital",                    area: "Central",  seg: "University"  },
    { id: "ACC011", name: "Bumrungrad International",            area: "Central",  seg: "Private"     },
    { id: "ACC012", name: "King Chulalongkorn Memorial Hospital",area: "Central",  seg: "Government"  },
    { id: "ACC013", name: "NE Welfare Hospital Udonthani",       area: "North",    seg: "Government"  },
    { id: "ACC014", name: "Chularat 3 International",            area: "Central",  seg: "Private"     },
    { id: "ACC015", name: "Bangkok Hospital Udon",               area: "North",    seg: "Private"     },
    { id: "ACC016", name: "Mahidol University Hospital",         area: "Central",  seg: "University"  },
    { id: "ACC017", name: "Saraburi Hospital",                   area: "Central",  seg: "Government"  },
    { id: "ACC018", name: "Chiang Mai Ram Hospital",             area: "North",    seg: "Private"     },
    { id: "ACC019", name: "Khon Kaen Hospital",                  area: "North",    seg: "Government"  },
    { id: "ACC020", name: "Bangkok Hospital",                    area: "Central",  seg: "Private"     },
    { id: "ACC021", name: "1.TEC EQC Store",                     area: "Central",  seg: "Internal"    },
    { id: "ACC022", name: "King Chulalongkorn",                  area: "Central",  seg: "Government"  },
    { id: "ACC023", name: "Repair Center",                       area: "Central",  seg: "Internal"    },
  ];
  for (const r of accountRows) {
    const a = await prisma.account.create({
      data: { account_name: r.name, area: r.area, segmentation: r.seg },
    });
    accById.set(r.id, a.account_id);
    accByName.set(r.name, a.account_id);
  }
  console.log(`   ✓ ${accountRows.length} rows`);

  // ── STEP 3: ACCESSORY MASTER ─────────────────────────────────────────────────
  console.log("3/17 Accessory master...");
  const accessoryRows = [
    { id: "ACCY001", code: "LSC-100", name: "Light Source Cable" },
    { id: "ACCY002", code: "WB-210",  name: "Water Bottle"       },
    { id: "ACCY003", code: "BV-550",  name: "Biopsy Valve"       },
    { id: "ACCY004", code: "VP-900",  name: "Video Processor"    },
    { id: "ACCY005", code: "TC-111",  name: "Transport Case"     },
  ];
  for (const r of accessoryRows) {
    const a = await prisma.accessoryMaster.upsert({
      where:  { accessory_code: r.code },
      update: {},
      create: { accessory_code: r.code, accessory_name: r.name, is_active: true },
    });
    accessById.set(r.id, a.accessory_id);
    accyByName.set(r.name, a.accessory_id);
  }
  console.log(`   ✓ ${accessoryRows.length} rows`);

  // ── STEP 4: ASSETS (no service_contract_id yet) ──────────────────────────────
  console.log("4/17 Assets...");
  const assetRows = [
    { name: "CH-S700-XZ-EA", serial: "7200524",  model: "CH-S700-XZ-EA", status: "Available",      type: "Loaner_Asset",    wh: "1.TEC EQC Store",        acct: "Buddachinarai Hospital" },
    { name: "GIF-Q158",      serial: "2307145",  model: "GIF-Q158",      status: "With_Customer",  type: "Loaner_Asset",    wh: "Manon Naval Hospital",    acct: "Manon Naval Hospital"   },
    { name: "CF-Q165L",      serial: "2760115",  model: "CF-Q165L",      status: "Under_Repair",   type: "Loaner_Asset",    wh: "Repair Center",          acct: "NE Welfare Hospital"    },
    { name: "OTV-S200",      serial: "7559775",  model: "OTV-S200",      status: "Available",      type: "Service_Center",  wh: "1.TEC EQC Store",        acct: "1.TEC EQC Store"        },
    { name: "HYF-XP",        serial: "2312794",  model: "HYF-XP",        status: "Available",      type: "Loaner_Asset",    wh: "1.TEC EQC Store",        acct: "1.TEC EQC Store"        },
    { name: "HYF-XP",        serial: "7420507",  model: "HYF-XP",        status: "Available",      type: "Loaner_Asset",    wh: "1.TEC EQC Store",        acct: "1.TEC EQC Store"        },
    { name: "MD-431",        serial: "MD431LN07",model: "MD-431",         status: "Available",      type: "Loaner_Asset",    wh: "1.TEC EQC Store",        acct: "1.TEC EQC Store"        },
    { name: "CLV-180",       serial: "7709592",  model: "CLV-180",       status: "With_Customer",  type: "Loaner_Asset",    wh: "Bangkok Hospital Udon",  acct: "Bangkok Hospital Udon"  },
    { name: "OEV-191H",      serial: "7028875",  model: "OEV-191H",      status: "Available",      type: "Loaner_Asset",    wh: "1.TEC EQC Store",        acct: "1.TEC EQC Store"        },
    { name: "BF-1T150",      serial: "2040400",  model: "BF-1T150",      status: "Preparing",      type: "Loaner_Asset",    wh: "1.TEC EQC Store",        acct: "Khon Kaen Hospital"     },
    { name: "CV-V1",         serial: "1300499",  model: "CV-V1",         status: "Available",      type: "Service_Center",  wh: "1.TEC EQC Store",        acct: "1.TEC EQC Store"        },
    { name: "GIF-H190",      serial: "2200584",  model: "GIF-H190",      status: "Available",      type: "Loaner_Asset",    wh: "1.TEC EQC Store",        acct: "1.TEC EQC Store"        },
    { name: "GIF-V2",        serial: "2714368",  model: "GIF-V2",        status: "Available",      type: "Loaner_Asset",    wh: "1.TEC EQC Store",        acct: "1.TEC EQC Store"        },
    { name: "TJF-Q180V",     serial: "3300782",  model: "TJF-Q180V",     status: "Extension_Used", type: "Loaner_Asset",    wh: "King Chulalongkorn",     acct: "King Chulalongkorn"     },
    { name: "GIF-XQ290",     serial: "3100995",  model: "GIF-XQ290",     status: "With_Customer",  type: "Loaner_Asset",    wh: "Chiang Mai Ram Hospital", acct: "Chiang Mai Ram Hospital"},
  ];
  for (const r of assetRows) {
    const a = await prisma.asset.upsert({
      where: { serial_number: r.serial },
      update: {},
      create: {
        asset_name:       r.name,
        serial_number:    r.serial,
        model_code:       r.model,
        status:           r.status,
        demo_loaner_type: r.type,
        warehouse_code:   r.wh,
        account_id:       accByName.get(r.acct) ?? null,
        is_active:        true,
      },
    });
    assetBySerial.set(r.serial, a.asset_id);
    // Store only first occurrence per asset_name (duplicates like HYF-XP are keyed by serial)
    if (!assetByName.has(r.name)) assetByName.set(r.name, a.asset_id);
  }
  console.log(`   ✓ ${assetRows.length} rows`);

  // ── STEP 5: REPAIR CASES ────────────────────────────────────────────────────
  console.log("5/17 Repair cases...");
  // Map assets needed for repair cases that aren't in assets.csv (by serial)
  const repairAssetRows = [
    { serial: "2349141", name: "TIF-Q180V",  model: "TIF-Q180V",  type: "Loaner_Asset" },
    { serial: "2350261", name: "GIF-H290",   model: "GIF-H290",   type: "Loaner_Asset" },
    { serial: "2260112", name: "CF-H90L",    model: "CF-H90L",    type: "Loaner_Asset" },
    { serial: "3125441", name: "ITF-SLIM",   model: "ITF-SLIM",   type: "Loaner_Asset" },
    { serial: "2198771", name: "TJF-Q180V",  model: "TJF-Q180V",  type: "Loaner_Asset" },
    { serial: "3300112", name: "GIF-XQ290",  model: "GIF-XQ290",  type: "Loaner_Asset" },
    { serial: "3100044", name: "GIF-Q158",   model: "GIF-Q158",   type: "Loaner_Asset" },
  ];
  for (const r of repairAssetRows) {
    if (!assetBySerial.has(r.serial)) {
      const a = await prisma.asset.upsert({
        where: { serial_number: r.serial },
        update: {},
        create: { asset_name: r.name, serial_number: r.serial, model_code: r.model, status: "Under_Repair", demo_loaner_type: r.type, is_active: true },
      });
      assetBySerial.set(r.serial, a.asset_id);
    }
  }

  const repairCaseRows = [
    { rs: "RS-202602-099595", eas: "9349141", status: "Quoted",          acct: "Buddachinarai Hospital",      serial: "7200524",  type: "Normal_Repair",    area: "NORTH",   cost: 45000   },
    { rs: "RS-202512-097878", eas: "9349742", status: "IQ_Quoted",       acct: "London Hospital",             serial: "2349141",  type: "Normal_Repair",    area: "CENTRAL", cost: 72000   },
    { rs: "RS-202511-095300", eas: "9341122", status: "PO_Received",     acct: "Ramathibodi Hospital",        serial: "2307145",  type: "Normal_Repair",    area: "CENTRAL", cost: 38500   },
    { rs: "RS-202602-099400", eas: "9348800", status: "IQ_Quoted",       acct: "Siriraj Hospital",            serial: "2760115",  type: "Q3S_Repair",       area: "CENTRAL", cost: 91000   },
    { rs: "RS-202510-093000", eas: "9335500", status: "Parts_Arranged",  acct: "Bumrungrad International",    serial: "2350261",  type: "Normal_Repair",    area: "CENTRAL", cost: 55000   },
    { rs: "RS-202509-091000", eas: "9322000", status: "Confirmed",       acct: "Bangkok Hospital",            serial: "2260112",  type: "Service_Contract", area: "CENTRAL", cost: 0       },
    { rs: "RS-202602-099700", eas: "9349900", status: "Parts_Arranged",  acct: "Bangkok Hospital Udon",       serial: "3125441",  type: "Normal_Repair",    area: "EAST",    cost: 48500   },
    { rs: "RS-202602-099800", eas: "9350100", status: "Confirmed",       acct: "Mahidol University Hospital", serial: "2198771",  type: "GI_Repair",        area: "CENTRAL", cost: 63000   },
    { rs: "RS-202601-098000", eas: "9345500", status: "Quoted",          acct: "Chiang Mai Ram Hospital",     serial: "3300112",  type: "Normal_Repair",    area: "NORTH",   cost: 42000   },
    { rs: "RS-202511-097182", eas: "9347200", status: "IQ_Quoted",       acct: "Manon Naval Hospital",        serial: "3100044",  type: "Normal_Repair",    area: "NORTH",   cost: 39000   },
  ];
  for (const r of repairCaseRows) {
    const rc = await prisma.repairCase.upsert({
      where: { rs_number: r.rs },
      update: {},
      create: {
        rs_number:       r.rs,
        eas_no:          r.eas,
        status:          r.status,
        asset_id:        assetBySerial.get(r.serial)!,
        account_id:      accByName.get(r.acct)!,
        repair_type:     r.type,
        area:            r.area,
        repair_cost_thb: r.cost,
      },
    });
    repairByRs.set(r.rs, rc.repair_id);
  }
  console.log(`   ✓ ${repairCaseRows.length} rows`);

  // ── STEP 6: BOM SETS ─────────────────────────────────────────────────────────
  console.log("6/17 BOM sets...");
  const bomSetRows = [
    { id: "BOM001", name: "Set A", model: "GIF-Q158",   ver: "v2.1", desc: "Gastroscope standard set",    active: true,  date: new Date("2026-01-01"), owner: "USR004" },
    { id: "BOM002", name: "Set B", model: "CF-Q165L",   ver: "v1.8", desc: "Colonoscope procedure set",  active: true,  date: new Date("2026-01-15"), owner: "USR004" },
    { id: "BOM003", name: "Set C", model: "TIF-Q180V",  ver: "v3.0", desc: "Video scope inspection set", active: false, date: new Date("2026-02-01"), owner: "USR002" },
  ];
  for (const r of bomSetRows) {
    const b = await prisma.bomSet.upsert({
      where: { set_name: r.name },
      update: {},
      create: {
        set_name:       r.name,
        model_code:     r.model,
        version:        r.ver,
        description:    r.desc,
        is_active:      r.active,
        effective_date: r.date,
        created_by_id:  userById.get(r.owner)!,
      },
    });
    bomById.set(r.id, b.set_id);
  }
  console.log(`   ✓ ${bomSetRows.length} rows`);

  // ── STEP 7: BOM LINE ITEMS ───────────────────────────────────────────────────
  console.log("7/17 BOM line items...");
  const bomLineRows = [
    { lineId: "fe0b495f-5894-42d1-906b-091410f812c3", bom: "BOM001", accy: "ACCY001", qty: 1, req: true,  opt: false },
    { lineId: "4c3092d3-bf2b-4538-b1e1-1f47e7f1080d", bom: "BOM001", accy: "ACCY002", qty: 1, req: true,  opt: false },
    { lineId: "e229c00f-1040-41b6-a3f5-ce1eb874f9a8", bom: "BOM002", accy: "ACCY004", qty: 1, req: true,  opt: false },
    { lineId: "380eb3df-accd-4d99-a4ff-8af20c6ee9ee", bom: "BOM002", accy: "ACCY005", qty: 1, req: false, opt: true  },
    { lineId: "19819c54-51c6-4510-85f2-6dc05c523075", bom: "BOM003", accy: "ACCY003", qty: 2, req: true,  opt: false },
  ];
  for (let i = 0; i < bomLineRows.length; i++) {
    const r = bomLineRows[i];
    const accyId = accessById.get(r.accy)!;
    await prisma.bomLineItem.create({
      data: {
        line_id:          r.lineId,
        set_id:           bomById.get(r.bom)!,
        accessory_id:     accyId,
        sequence_no:      i + 1,
        quantity_required: r.qty,
        is_required:      r.req,
        is_optional:      r.opt,
        is_consumable:    false,
      },
    });
    if (!bomLineByAccessory.has(accyId)) bomLineByAccessory.set(accyId, r.lineId);
  }
  console.log(`   ✓ ${bomLineRows.length} rows`);

  // ── STEP 8: SALES REQUESTS ───────────────────────────────────────────────────
  console.log("8/17 Sales requests...");
  const salesRequestRows = [
    { num: "DR-2602-106504", type: "First_Request",     status: "Request_Complete",   acct: "Buddachinarai Hospital",              p1: "Repair",   p2: "Normal_Repair_Loaner", start: "2026-02-10", ret: "2026-03-05", rs: "RS-202602-099595", sp: "Porngak Suriya"  },
    { num: "DR-2602-106202", type: "First_Request",     status: "Waiting_Reservation",acct: "London Hospital",                     p1: "Others",   p2: "VPP_CPP_Rental",       start: "2026-02-12", ret: "2026-03-15", rs: null,               sp: "Jakkraphan W."   },
    { num: "DR-2603-107269", type: "Extension_Request", status: "Waiting_Approval",   acct: "Manon Naval Hospital",                p1: "Repair",   p2: "Normal_Repair_Loaner", start: "2026-03-01", ret: "2026-04-01", rs: "RS-202511-097182", sp: "Anti Kessle"     },
    { num: "DR-2602-106300", type: "First_Request",     status: "Request_Complete",   acct: "Thammasat University Hospital",       p1: "Others",   p2: "VPP_CPP_Rental",       start: "2026-02-14", ret: "2026-03-14", rs: null,               sp: "Ronton Josh"     },
    { num: "DR-2602-106050", type: "First_Request",     status: "Dispatched",         acct: "Siriraj Hospital",                    p1: "Repair",   p2: "Q3S_Loaner",           start: "2026-02-08", ret: "2026-03-08", rs: "RS-202602-099400", sp: "Preeyanan K."    },
    { num: "DR-2509-088601", type: "First_Request",     status: "Request_Complete",   acct: "Bumrungrad International",            p1: "Others",   p2: "VPP_CPP_Rental",       start: "2025-09-10", ret: "2025-10-10", rs: null,               sp: "Kanokwan S."     },
    { num: "DR-2510-090023", type: "First_Request",     status: "With_Customer",      acct: "King Chulalongkorn Memorial Hospital",p1: "Sales",    p2: "Demonstration",        start: "2025-10-01", ret: "2025-10-15", rs: null,               sp: "Vit Thamrong"    },
    { num: "DR-2511-092500", type: "First_Request",     status: "Request_Complete",   acct: "Ramathibodi Hospital",                p1: "Repair",   p2: "Normal_Repair_Loaner", start: "2025-11-05", ret: "2025-12-05", rs: "RS-202511-095300", sp: "Ark Suranon"     },
    { num: "DR-2512-095000", type: "First_Request",     status: "Request_Complete",   acct: "NE Welfare Hospital Udonthani",       p1: "Repair",   p2: "Q3_Loaner",            start: "2025-12-01", ret: "2026-01-01", rs: "RS-202512-097878", sp: "Anti Kessle"     },
    { num: "DR-2601-100100", type: "First_Request",     status: "Waiting_Reservation",acct: "Chularat 3 International",            p1: "Others",   p2: "Demonstration",        start: "2026-01-10", ret: "2026-01-25", rs: null,               sp: "Tee Charoensuk"  },
    { num: "DR-2602-106900", type: "Extension_Request", status: "With_Customer",      acct: "Bangkok Hospital Udon",               p1: "Repair",   p2: "Normal_Repair_Loaner", start: "2026-02-20", ret: "2026-03-20", rs: "RS-202602-099700", sp: "Ronton Josh"     },
    { num: "DR-2602-107000", type: "First_Request",     status: "Request_Complete",   acct: "Mahidol University Hospital",         p1: "Repair",   p2: "GI3_Loaner",           start: "2026-02-25", ret: "2026-03-25", rs: "RS-202602-099800", sp: "Jakkraphan W."   },
    { num: "DR-2603-107100", type: "First_Request",     status: "Waiting_Approval",   acct: "Saraburi Hospital",                   p1: "Sales",    p2: "Demonstration",        start: "2026-03-15", ret: "2026-03-30", rs: null,               sp: "Porngak Suriya"  },
    { num: "DR-2603-107210", type: "First_Request",     status: "Preparing",          acct: "Chiang Mai Ram Hospital",             p1: "Repair",   p2: "Normal_Repair_Loaner", start: "2026-03-05", ret: "2026-04-05", rs: "RS-202601-098000", sp: "Ark Suranon"     },
    { num: "DR-2603-107350", type: "First_Request",     status: "BOM_Confirmed",      acct: "Khon Kaen Hospital",                  p1: "QARA",     p2: "Qualification_Regulation", start: "2026-03-12", ret: "2026-04-12", rs: null,             sp: "Preeyanan K."    },
  ];
  for (const r of salesRequestRows) {
    const spId = userByName.get(r.sp)!;
    const sr = await prisma.salesRequest.upsert({
      where: { request_number: r.num },
      update: {},
      create: {
        request_number:      r.num,
        record_type:         r.type,
        status:              r.status,
        account_id:          accByName.get(r.acct)!,
        purpose1:            r.p1,
        purpose2:            r.p2,
        request_date:        new Date(r.start),
        start_use_date:      new Date(r.start),
        estimate_return_date:new Date(r.ret),
        repair_case_id:      r.rs ? repairByRs.get(r.rs) ?? null : null,
        sales_person_id:     spId,
        created_by_id:       spId,
      },
    });
    reqByNum.set(r.num, sr.request_id);
  }
  console.log(`   ✓ ${salesRequestRows.length} rows`);

  // ── STEP 9: REQUEST EXTENSIONS ───────────────────────────────────────────────
  console.log("9/17 Request extensions...");
  const extensionRows = [
    { id: "7460c543-148e-45f1-87e9-08e732fbbc3e", req: "DR-2603-107269", newRet: "2026-04-15", reason: "Customer requested extended evaluation", status: "Approved",  approver: "USR002" },
    { id: "99f47037-b055-45da-9bba-f557dd639e10", req: "DR-2602-106202", newRet: "2026-03-30", reason: "Surgery schedule delayed",                status: "Waiting_Approval", approver: "USR001" },
    { id: "1f716390-dea3-4c2c-b4b6-2acf1c6ec64e", req: "DR-2602-106504", newRet: "2026-03-18", reason: "Repair completion pending",               status: "Approved",  approver: "USR003" },
  ];
  for (const r of extensionRows) {
    await prisma.requestExtension.create({
      data: {
        extension_id:     r.id,
        parent_request_id: reqByNum.get(r.req)!,
        new_return_date:  new Date(r.newRet),
        reason_code:      "Customer_Request",
        reason_text:      r.reason,
        status:           r.status,
        approved_by_id:   userById.get(r.approver) ?? null,
      },
    });
  }
  console.log(`   ✓ ${extensionRows.length} rows`);

  // ── STEP 10: DEVICE DEPLOYMENTS ──────────────────────────────────────────────
  console.log("10/17 Device deployments...");
  const deploymentRows = [
    { id: "6dd84f30-60e8-4117-9f6e-3f215f65b7c9", req: "DR-2602-106504", serial: "7200524",  type: "Demo",         status: "With_Customer", start: "2026-02-10", ret: "2026-03-05", actualRet: "2026-03-05", condOut: "Good",      condIn: "Good",    owner: "USR001" },
    { id: "0a58a49f-4ba7-4da0-bb66-66d472e367f7", req: "DR-2602-106202", serial: "2307145",  type: "Loaner",       status: "Returned",      start: "2026-02-12", ret: "2026-03-15", actualRet: "2026-03-14", condOut: "Good",      condIn: "Good",    owner: "USR002" },
    { id: "34778678-224a-4c05-90f3-faf2885ee38f", req: "DR-2603-107269", serial: "2760115",  type: "Loaner",       status: "With_Customer", start: "2026-03-01", ret: "2026-04-01", actualRet: null,         condOut: "Good",      condIn: null,      owner: "USR003" },
  ];
  for (const r of deploymentRows) {
    await prisma.deviceDeployment.create({
      data: {
        deployment_id:        r.id,
        request_id:           reqByNum.get(r.req)!,
        asset_id:             assetBySerial.get(r.serial)!,
        deployment_type:      r.type,
        status:               r.status,
        start_date:           new Date(r.start),
        expected_return_date: new Date(r.ret),
        actual_return_date:   r.actualRet ? new Date(r.actualRet) : null,
        condition_on_dispatch: r.condOut,
        condition_on_return:   r.condIn ?? null,
        responsible_eqc_id:   userById.get(r.owner) ?? null,
      },
    });
    deplByNum.set(r.req, r.id);
    deplByAsset.set(r.serial, r.id);
  }
  console.log(`   ✓ ${deploymentRows.length} rows`);

  // ── STEP 11: DISPATCH DOCUMENTS ──────────────────────────────────────────────
  console.log("11/17 Dispatch documents...");
  const dispatchRows = [
    { id: "c847df4d-8702-4c5f-8767-7d0487dbc922", req: "DR-2602-106504", date: "2026-02-09T09:00:00", qr: "QR-1001", pdf: "dispatch_1001.pdf", signedBy: "Porngak Suriya",  status: "Signed",    genBy: "USR001" },
    { id: "78f692d4-6c43-40e3-b886-08bbb1b6b658", req: "DR-2602-106202", date: "2026-02-11T13:15:00", qr: "QR-1002", pdf: "dispatch_1002.pdf", signedBy: "Jakkraphan W.",  status: "Signed",    genBy: "USR002" },
    { id: "660db7fc-e0f4-47ae-b707-7ff44a290fc7", req: "DR-2603-107269", date: "2026-02-28T08:20:00", qr: "QR-1003", pdf: "dispatch_1003.pdf", signedBy: null,              status: "Generated", genBy: "USR003" },
  ];
  for (const r of dispatchRows) {
    const deplId = deplByNum.get(r.req);
    if (!deplId) continue;
    await prisma.dispatchDocument.create({
      data: {
        doc_id:           r.id,
        deployment_id:    deplId,
        document_type:    "First_Request",
        qr_code_value:    r.qr,
        pdf_blob_url:     r.pdf,
        generated_by_id:  userById.get(r.genBy)!,
        generated_at:     new Date(r.date),
        status:           r.status,
        signed_by_name:   r.signedBy ?? null,
        signed_at:        r.status === "Signed" ? new Date(r.date) : null,
      },
    });
  }
  console.log(`   ✓ ${dispatchRows.length} rows`);

  // ── STEP 12: INSPECTION RECORDS ──────────────────────────────────────────────
  console.log("12/17 Inspection records...");
  const inspectionRows = [
    { id: "394e999e-90b6-4355-9492-df2495f42683", num: "INSP-001", serial: "7200524",  condition: "Good",          notes: "No visible defects",      inspector: "USR003", date: "2026-03-05T00:00:00" },
    { id: "88508d2f-84d3-4e6b-9424-95a615984c4c", num: "INSP-002", serial: "2307145",  condition: "Needs_Cleaning",notes: "Scratch on outer casing", inspector: "USR002", date: "2026-03-14T00:00:00" },
    { id: "20971684-ab23-4613-8944-e34d1cb27019", num: "INSP-003", serial: "2760115",  condition: null,            notes: "Awaiting return",          inspector: "USR003", date: "2026-04-02T00:00:00" },
  ];
  for (const r of inspectionRows) {
    const deplId = deplByAsset.get(r.serial);
    if (!deplId) continue;
    await prisma.inspectionRecord.create({
      data: {
        inspection_id:   r.id,
        deployment_id:   deplId,
        overall_condition: r.condition ?? null,
        notes:           r.notes,
        inspected_by_id: userById.get(r.inspector)!,
        inspected_at:    new Date(r.date),
      },
    });
    inspByNum.set(r.num, r.id);
  }
  console.log(`   ✓ ${inspectionRows.length} rows`);

  // ── STEP 13: INSPECTION LINE ITEMS ──────────────────────────────────────────
  console.log("13/17 Inspection line items...");
  const inspLineRows = [
    { id: "4e62fae6-34c1-47f6-b254-968ff6ab0660", insp: "INSP-001", itemName: "Light Source Cable", result: "Pass", notes: "Present — no action required" },
    { id: "1f00fd49-a11a-4704-b6a3-13dce0c9b7e0", insp: "INSP-001", itemName: "Water Bottle",       result: "Pass", notes: "Present — no action required" },
    { id: "b8a1840a-e7dc-4289-bcdf-0f9590352336", insp: "INSP-002", itemName: "Video Processor",    result: "Fail", notes: "Damaged — replace outer shell" },
    { id: "7590ae23-f66c-4291-afd3-ac80fc877d47", insp: "INSP-002", itemName: "Transport Case",     result: "Pass", notes: "Present — no action required" },
  ];
  for (const r of inspLineRows) {
    const inspId   = inspByNum.get(r.insp);
    const accyId   = accyByName.get(r.itemName);
    const bomLineId = accyId ? bomLineByAccessory.get(accyId) : undefined;
    if (!inspId || !bomLineId) continue;
    await prisma.inspectionLineItem.create({
      data: {
        item_id:         r.id,
        inspection_id:   inspId,
        bom_line_id:     bomLineId,
        result:          r.result,
        notes:           r.notes,
        inspection_type: "RETURN",
      },
    });
  }
  console.log(`   ✓ ${inspLineRows.length} rows`);

  // ── STEP 14: SERVICE CONTRACTS ───────────────────────────────────────────────
  console.log("14/17 Service contracts...");
  const contractRows = [
    { id: "65755a71-21a9-4e06-918f-a5473686be00", assetName: "CH-S700-XZ-EA", serial: "7200524",  type: "Gold",   start: "2026-01-01", end: "2027-01-01", num: "SC-001" },
    { id: "00e60d8d-1f99-4860-9e89-e3a41b9bc225", assetName: "GIF-Q158",      serial: "2307145",  type: "Silver", start: "2025-07-01", end: "2026-07-01", num: "SC-002" },
    { id: "73243600-c7e1-4ace-8723-37252baac5b5", assetName: "CF-Q165L",      serial: "2760115",  type: "Bronze", start: "2025-04-01", end: "2026-04-01", num: "SC-003" },
  ];
  const contractByAsset = new Map<string, string>(); // serial → contract_id
  for (const r of contractRows) {
    const assetId = assetBySerial.get(r.serial);
    if (!assetId) continue;
    await prisma.serviceContract.create({
      data: {
        contract_id:     r.id,
        contract_number: r.num,
        asset_id:        assetId,
        contract_type:   r.type,
        start_date:      new Date(r.start),
        end_date:        new Date(r.end),
      },
    });
    contractByAsset.set(r.serial, r.id);
  }
  console.log(`   ✓ ${contractRows.length} rows`);

  // ── STEP 15: UPDATE ASSETS WITH SERVICE CONTRACT ID ──────────────────────────
  console.log("15/17 Linking service contracts to assets...");
  for (const [serial, contractId] of contractByAsset) {
    const assetId = assetBySerial.get(serial);
    if (!assetId) continue;
    await prisma.asset.update({
      where: { asset_id: assetId },
      data:  { service_contract_id: contractId },
    });
  }
  console.log(`   ✓ ${contractByAsset.size} assets updated`);

  // ── STEP 16: EVENT LOG ───────────────────────────────────────────────────────
  console.log("16/17 Event log...");
  const eventRows = [
    { id: "b24dde51-7414-40ee-a3aa-857cd1626c10", entityType: "sales_request", entityRef: "DR-2602-106504", eventType: "Created",          actorId: "USR001", narrative: "Request created",           ts: "2026-02-01T10:00:00", old: "N/A",       new: "Draft"       },
    { id: "1ef777f1-fd62-4c78-8177-9d40304f92df", entityType: "asset",         entityRef: "2307145",        eventType: "Status_Changed",   actorId: "USR002", narrative: "Moved to With_Customer",    ts: "2026-02-12T14:00:00", old: "Available", new: "With_Customer"},
    { id: "0cf43d94-6514-423f-90fd-20e31d7d7932", entityType: "inspection",    entityRef: "INSP-002",       eventType: "Inspection_Failed",actorId: "USR003", narrative: "Damage detected",           ts: "2026-03-14T16:00:00", old: "Pass",      new: "Review"      },
  ];

  const entityUuid = (type: string, ref: string): string => {
    if (type === "sales_request") return reqByNum.get(ref) ?? ref;
    if (type === "asset")         return assetBySerial.get(ref) ?? ref;
    if (type === "inspection")    return inspByNum.get(ref) ?? ref;
    return ref;
  };

  for (const r of eventRows) {
    await prisma.eventLog.create({
      data: {
        log_id:      r.id,
        entity_type: r.entityType,
        entity_id:   entityUuid(r.entityType, r.entityRef),
        event_type:  r.eventType,
        old_value:   r.old,
        new_value:   r.new,
        actor_id:    userById.get(r.actorId) ?? null,
        actor_type:  "User",
        timestamp:   new Date(r.ts),
        narrative:   r.narrative,
      },
    });
  }
  console.log(`   ✓ ${eventRows.length} rows`);

  // ── STEP 17: TEAMS ALERT LOG ─────────────────────────────────────────────────
  console.log("17a/17 Teams alert log...");
  const teamsRows = [
    { id: "d37af54e-eca8-4c67-93e3-7c89b56cd2b8", type: "Overdue_Return",    ref: "DR-2602-106202", status: "Sent",   ts: "2026-03-16T09:00:00", msg: "Loaner overdue by 1 day",       msgId: "teams-alert-001" },
    { id: "dfd9fa8e-d042-4edc-a4be-4adf23730fa9", type: "Damage_Inspection", ref: "INSP-002",       status: "Sent",   ts: "2026-03-14T17:00:00", msg: "Damage found during inspection", msgId: "teams-alert-002" },
    { id: "b63d67d8-5d39-4c21-844a-9429bf22b93c", type: "Deployment_Active", ref: "DR-2603-107269", status: "Queued", ts: "2026-03-02T08:00:00", msg: "Deployment started",             msgId: "teams-alert-003" },
  ];
  for (const r of teamsRows) {
    await prisma.teamsAlertLog.create({
      data: {
        alert_id:        r.id,
        alert_type:      r.type,
        channel:         "teams",
        payload:         JSON.stringify({ message: r.msg, reference: r.ref }),
        delivery_status: r.status,
        message_id:      r.msgId,
        created_at:      new Date(r.ts),
      },
    });
  }
  console.log(`   ✓ ${teamsRows.length} rows`);

  // ── STEP 18: AI PREDICTION LOG ───────────────────────────────────────────────
  console.log("17b/17 AI prediction log...");
  const aiRows = [
    { id: "df495fc1-b69e-4392-93cb-a723b69cbc4a", serial: "7200524",  type: "OVERDUE_FORECAST", score: 0.82, text: "High probability of delayed return" },
    { id: "7de84bbb-140a-4904-986f-a32cb7ff114e", serial: "2307145",  type: "ANOMALY_DETECTION", score: 0.64, text: "Possible cosmetic damage"          },
    { id: "611c4738-c6f4-4e5f-8f94-adeab194b216", serial: "2760115",  type: "ANOMALY_DETECTION", score: 0.71, text: "Repair cost may exceed threshold"  },
  ];
  for (const r of aiRows) {
    await prisma.aiPredictionLog.create({
      data: {
        prediction_id:     r.id,
        prediction_type:   r.type,
        entity_id:         assetBySerial.get(r.serial) ?? r.serial,
        entity_type:       "asset",
        prediction_output: r.text,
        confidence_score:  r.score,
      },
    });
  }
  console.log(`   ✓ ${aiRows.length} rows`);

  console.log("\n✅ Seeding complete!");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
