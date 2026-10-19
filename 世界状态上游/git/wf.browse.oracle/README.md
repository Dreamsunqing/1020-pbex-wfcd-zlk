Note there's a cronjob to create/update the .gitignored files:
```php
$worldState_raw = file_get_contents("https://api.warframe.com/cdn/worldState.php");
if (strpos($worldState_raw, "WorldSeed") !== false)
{
	file_put_contents("/var/www/wf.browse.oracle/worldState.json", $worldState_raw);
	$worldState = json_decode($worldState_raw, true);

	file_put_contents("/var/www/wf.browse.oracle/worldState.min.json", json_encode([
		"Events" => $worldState["Events"],
		"Goals" => $worldState["Goals"],
		"Alerts" => $worldState["Alerts"],
		"Sorties" => $worldState["Sorties"],
		"LiteSorties" => $worldState["LiteSorties"],
		"ActiveMissions" => $worldState["ActiveMissions"],
		"VoidTraders" => $worldState["VoidTraders"],
		"VoidStorms" => $worldState["VoidStorms"],
		"DailyDeals" => $worldState["DailyDeals"],
		"Conquests" => $worldState["Conquests"],
		"Tmp" => $worldState["Tmp"],
	], JSON_UNESCAPED_SLASHES));
}
```
