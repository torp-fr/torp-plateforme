# Garder Render éveillé 24/7 (Gratuit)

## Problème
Render Free tier s'endort après 15 minutes d'inactivité, causant des cold starts de 30-60 secondes.

## Solution : UptimeRobot (Gratuit, illimité)

### 1. Créer un compte UptimeRobot

1. Allez sur **https://uptimerobot.com/**
2. Cliquez sur **"Sign Up Free"**
3. Créez un compte (email + mot de passe)

### 2. Ajouter un monitor

1. Une fois connecté, cliquez sur **"+ Add New Monitor"**

2. Configuration :
   ```
   Monitor Type: HTTP(s)
   Friendly Name: OCR Service Keepalive
   URL: https://ocr-service-x946.onrender.com/health
   Monitoring Interval: 5 minutes (gratuit)
   ```

3. Cliquez sur **"Create Monitor"**

### 3. C'est tout !

UptimeRobot va maintenant ping votre service toutes les 5 minutes, ce qui empêche Render de s'endormir.

**Résultat** :
- ✅ Render reste éveillé 24/7
- ✅ Pas de cold start (sauf redéploiement)
- ✅ Temps de réponse OCR : 2-5 secondes au lieu de 60+ secondes
- ✅ 100% gratuit (UptimeRobot permet 50 monitors gratuits)

---

## Alternative : Cron-job.org (Gratuit)

Si vous préférez une autre solution :

1. **https://cron-job.org/**
2. **Create free account**
3. **Create cronjob** :
   ```
   Title: Render OCR Keepalive
   Address: https://ocr-service-x946.onrender.com/health
   Schedule: */10 * * * * (toutes les 10 minutes)
   ```
4. **Save**

---

## Vérification

Une fois configuré, vérifiez dans **Render Dashboard** → **Logs** :

Vous devriez voir toutes les 5-10 minutes :
```
INFO: 123.456.789.0:0 - "GET /health HTTP/1.1" 200 OK
```

Si vous voyez ces logs régulièrement, le keepalive fonctionne ! ✅

---

## Bonus : Email d'alerte si le service tombe

UptimeRobot vous envoie aussi un email si le service devient indisponible (downtime), ce qui est très utile pour le monitoring.
