#!/usr/bin/env python3
"""创建完整模拟数据"""
import asyncio, httpx, random, json, os

BASE = "http://localhost:8000/api/v1"

async def main():
    async with httpx.AsyncClient(timeout=120) as client:
        # Login
        password = os.getenv("ADMIN_PASSWORD")
        if not password:
            print("Set ADMIN_PASSWORD before creating mock data.")
            return
        r = await client.post(f"{BASE}/auth/login", json={"username":"admin","password":password})
        if r.status_code != 200:
            print(f"Login failed: {r.status_code} {r.text}"); return
        token = r.json()["access_token"]
        H = {"Authorization": f"Bearer {token}"}

        async def post(path, data):
            r = await client.post(f"{BASE}/{path}", headers=H, json=data)
            try:
                return r.status_code, r.json()
            except Exception:
                return r.status_code, {"raw": r.text[:200]}

        async def gl(path):
            r = await client.get(f"{BASE}/{path}", headers=H)
            if r.status_code != 200: return []
            d = r.json()
            if isinstance(d, list): return d
            for k in ("data","items"):
                if isinstance(d, dict) and k in d:
                    v = d[k]
                    if isinstance(v, list): return v
                    if isinstance(v, dict) and "items" in v: return v["items"]
            return []

        def uid(d):
            if isinstance(d, dict): return d.get("id") or d.get("data",{}).get("id")
            return None

        ok = fail = 0

        ud = [("中共XX省委办公厅","DJ001","party",1),("中共XX省纪委监委","DJ002","discipline",1),
              ("中共XX省委组织部","DJ003","organization",1),("中共XX省委宣传部","DJ004","propaganda",1),
              ("XX省发展和改革委员会","J003","government",2),("XX省教育厅","J004","government",2),
              ("XX省科学技术厅","J005","government",2),("XX省工业和信息化厅","J006","government",2),
              ("XX省公安厅","J007","government",2),("XX省民政厅","J008","government",2),
              ("XX省财政厅","J009","government",2),("XX省人社厅","J010","government",2),
              ("XX省自然资源厅","J011","government",2),("XX省生态环境厅","J012","government",2),
              ("XX省住建厅","J013","government",2),("XX省交通运输厅","J014","government",2),
              ("XX省水利厅","J015","government",2),("XX省农业农村厅","J016","government",2),
              ("XX省商务厅","J017","government",2),("XX市市委办公室","S001","party",3)]
        units = []
        for name,code,utype,level in ud:
            s, d = await post("units/", {"name":name,"org_code":code,"unit_type":utype,"level":level,"contact_person":f"联系人{random.randint(1,99)}","contact_phone":f"138{random.randint(10000000,99999999)}"})
            if s in (200,201):
                u = uid(d)
                if u: units.append(u); ok+=1
                else: fail+=1
            else: fail+=1; print(f"  fail unit {name} {s}")
        print(f"单位: {len(units)}")

        cadres = []
        nm = ["王建国","李明华","张秀英","刘德旺","陈建华","杨志强","赵国庆","黄文静","周树森","吴海燕",
              "徐建平","孙丽娟","马晓东","朱洪兵","胡晓峰","郭玉芬","林志远","何秀兰","高建明","张丽娜",
              "李志强","王秀英","陈德文","刘建华","杨国庆","赵文静","黄树森","周海燕","吴建平","徐丽娟"]
        for i,name in enumerate(nm):
            s, d = await post("cadres/", {"name":name,"gender":"男" if i%2==0 else "女","id_card":f"110101{random.randint(19500101,20001231)}{random.randint(1000,9999)}","position":["处长","副处长","科长","副科长","科员","主任"][i%6],"rank":["正厅级","副厅级","正处级","副处级","正科级","副科级"][i%6],"current_unit_id":units[i%len(units)] if units else None,"phone":f"138{random.randint(10000000,99999999)}","is_reserved":i<10})
            if s in (200,201):
                c = uid(d)
                if c: cadres.append(c); ok+=1
                else: fail+=1
            else: fail+=1; print(f"  fail cadre {name} {s}")
        print(f"干部: {len(cadres)}")

        kd = [("中国共产党章程","party","1.0"),("中国共产党纪律处分条例","discipline","1.0"),
              ("中国共产党巡视工作条例","inspection","2.0"),("中华人民共和国监察法","law","1.0"),
              ("中央八项规定精神","regulation","3.0"),("中国共产党问责条例","accountability","1.0"),
              ("党政领导干部选拔任用工作条例","cadre","2.0"),("三严三实专题教育","education","1.0"),
              ("两学一做学习教育","education","2.0"),("巡察工作规范化指引","guide","1.0")]
        for title,cat,ver in kd:
            s, _ = await post("knowledge/", {"title":title,"category":cat,"version":ver,"content":f"{title}完整内容...","tags":[cat],"status":"published"})
            if s in (200,201): ok+=1
            else: fail+=1; print(f"  fail k {title} {s}")
        print(f"知识库: {len(await gl('knowledge/'))}")

        plans = []
        for name,year,rn in [("2026年第一轮巡察",2026,"第一轮"),("2026年第二轮巡察",2026,"第二轮"),("2025年专项巡察",2025,"专项巡察"),("2025年机动巡察",2025,"机动巡察"),("2025年第三轮巡察",2025,"第三轮")]:
            s, d = await post("plans/", {"name":name,"year":year,"round_name":rn,"planned_start_date":"2026-01-01T00:00:00","planned_end_date":"2026-12-31T00:00:00"})
            if s in (200,201):
                p = uid(d)
                if p:
                    plans.append(p); ok+=1
                    await client.post(f"{BASE}/plans/{p}/submit", headers=H)
                    await client.post(f"{BASE}/plans/{p}/approve", headers=H)
                else: fail+=1
            else: fail+=1; print(f"  fail plan {name} {s}")
        print(f"计划: {len(plans)}")

        groups = []
        gn = ["第一巡察组","第二巡察组","第三巡察组","专项巡察组","机动巡察组","回访巡察组"]
        for i,gname in enumerate(gn):
            if i < len(plans):
                s, d = await post("groups/", {"name":gname,"plan_id":plans[i%len(plans)],"target_unit_id":units[i%len(units)] if units else None})
                if s in (200,201):
                    g = uid(d)
                    if g:
                        groups.append(g); ok+=1
                        if i < len(cadres):
                            await client.post(f"{BASE}/groups/{g}/members", headers=H, json={"cadre_id":cadres[i],"role":"leader" if i==0 else "member","is_leader":i==0})
                        await client.post(f"{BASE}/groups/{g}/submit", headers=H)
                    else: fail+=1
                else: fail+=1; print(f"  fail group {gname} {s}")
        print(f"巡察组: {len(groups)}")

        cats = ["违反纪律","违反中央八项规定精神","形式主义","官僚主义","廉洁纪律","群众纪律"]
        probs = ["违规吃喝","违规收礼","公款旅游","超标接待","慵懒散慢","推诿扯皮","不作为","乱作为"]
        sevs = ["low", "medium", "high"]
        for i in range(15):
            s, d = await post("drafts/", {"title":f"关于{ud[i%len(ud)][0]}的{cats[i%len(cats)]}问题",
                "unit_id":units[i%len(units)] if units else None,
                "group_id":groups[i%len(groups)] if groups else None,
                "category":cats[i%len(cats)],"problem_type":probs[i%len(probs)],"severity":sevs[i%len(sevs)],
                "description":f"经巡察发现，存在以下问题：{probs[i%len(probs)]}...",
                "legal_basis":"《中国共产党纪律处分条例》第XX条","suggested_treatment":"建议给予批评教育"})
            if s in (200,201):
                dr = uid(d)
                if dr:
                    ok+=1; await client.post(f"{BASE}/drafts/{dr}/submit", headers=H)
                else: fail+=1
            else: fail+=1; print(f"  fail draft {i+1} {s}")
        print(f"底稿: {len(await gl('drafts/'))}")

        cld = [("反映某领导干部收受礼品问题","违纪","群众举报","重要"),("某单位公款吃喝问题举报","违反中央八项规定","群众举报","重要"),
               ("某领导干部生活作风问题","违纪","网络舆情","重大"),("某单位违规发放津补贴","违反中央八项规定","审计移交","重要"),
               ("某干部涉嫌职务侵占","职务犯罪","执法发现","重大"),("某单位办公用房超标","违反中央八项规定","监督检查","一般"),
               ("某领导干部瞒报个人事项","违纪","上级交办","重要"),("某单位私设小金库","违法","审计移交","重大"),
               ("某干部违规经商办企业","违纪","群众举报","重要"),("某单位形式主义问题","形式主义","网络舆情","一般")]
        for title,cat,src,sev in cld:
            s, _ = await post("clues/", {"title":title,"category":cat,"source":src,"severity":sev,"content":f"线索详情：{title}...","report_date":"2026-01-15"})
            if s in (200,201): ok+=1
            else: fail+=1; print(f"  fail clue {title[:20]} {s}")
        print(f"线索: {len(await gl('clues/'))}")

        rd = [("关于规范公务接待行为的整改","green"),("关于严格控制办公经费支出的整改","yellow"),
              ("关于加强干部日常监督管理的整改","yellow"),("关于严肃党内政治生活的整改","orange"),
              ("关于落实中央八项规定精神的整改","orange"),("关于加强三重一大决策制度的整改","red"),
              ("关于规范选人用人程序的整改","yellow"),("关于加强财务管理的整改","green"),
              ("关于改进工作作风的整改","green"),("关于强化主体责任的整改","yellow")]
        for title,alert in rd:
            s, _ = await post("rectifications/", {"title":title,"unit_id":units[random.randint(0,len(units)-1)] if units else None,"problem_description":f"{title}的问题描述...","deadline":"2026-06-30T00:00:00","alert_level":alert,"status":"dispatched"})
            if s in (200,201): ok+=1
            else: fail+=1; print(f"  fail rect {title[:20]} {s}")
        print(f"整改: {len(await gl('rectifications/'))}")

        for username,realname,email,role in [("zhangwei","张伟","zhangwei@example.com","操作员"),("lina","李娜","lina@example.com","审核员"),("wangfang","王芳","wangfang@example.com","数据员")]:
            s, d = await post("admin/users", {"username":username,"password":"pass123","email":email,"full_name":realname,"role":role,"is_active":True})
            if s in (200,201): ok+=1
            else: fail+=1; print(f"  fail user {username}: {s} {d}")
        print(f"用户: {len(await gl('admin/users'))}")

        print(f"\n=== 完成: ok={ok} fail={fail} ===")

if __name__ == "__main__":
    asyncio.run(main())
