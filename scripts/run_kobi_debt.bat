@echo off
cd /d "C:\Projects\הריזורט לכלב"
node scripts\send_kobi_debt_job.cjs --run-now >> scratch\kobi_debt_cron.log 2>&1
