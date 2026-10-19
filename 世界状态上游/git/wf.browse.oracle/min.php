<?php
header("Cache-Control: public, max-age=30");
header("Content-Type: application/json");

function readJsonFile($filename) {
	$content = file_get_contents($filename);
	while ($content === false || ($json = json_decode($content, true)) === null) {
		$content = file_get_contents($filename);
	}
	return $json;
}

$worldState = readJsonFile("worldState.json");
$redtext = json_decode(file_get_contents("redtext.json"), true);
$response = [
	"version" => 1,
	"latestEvent" => 0,
	"latestRedtext" => end($redtext)["time"],
	"darvoSold" => 0,
	"invasions" => 0,
	"alerts" => count($worldState["Alerts"] ?? []),
	"goals" => count($worldState["Goals"] ?? []),
	"fissures" => 0
];

$latestEvent = 0;
if (!empty($worldState["Events"])) {
	foreach ($worldState["Events"] as $event) {
		if (isset($event["Date"]["\$date"]["\$numberLong"])) {
			$timeMs = (int)$event["Date"]["\$date"]["\$numberLong"];
			if ($timeMs > $latestEvent) {
				$latestEvent = $timeMs;
			}
		}
	}
}
$response["latestEvent"] = intdiv($latestEvent, 1000);

$now = time();
if (!empty($worldState["DailyDeals"])) {
	foreach ($worldState["DailyDeals"] as $deal) {
		$start = intdiv((int)$deal["Activation"]["\$date"]["\$numberLong"], 1000);
		$end = intdiv((int)$deal["Expiry"]["\$date"]["\$numberLong"], 1000);
		if ($now >= $start && $now < $end) {
			$response["darvoSold"] = $deal["AmountSold"] ?? 0;
			break;
		}
	}
}

if (!empty($worldState["Invasions"])) {
	foreach ($worldState["Invasions"] as $invasion) {
		if (empty($invasion["Completed"])) {
			$response["invasions"]++;
		}
	}
}

if (!empty($worldState["ActiveMissions"])) {
	foreach ($worldState["ActiveMissions"] as $mission) {
		$start = intdiv((int)$mission["Activation"]["\$date"]["\$numberLong"], 1000);
		$end = intdiv((int)$mission["Expiry"]["\$date"]["\$numberLong"], 1000);
		if ($now >= $start && $now < $end) {
			$response["fissures"]++;
		}
	}
}

if (!empty($worldState["VoidStorms"])) {
	foreach ($worldState["VoidStorms"] as $storm) {
		$start = intdiv((int)$storm["Activation"]["\$date"]["\$numberLong"], 1000);
		$end = intdiv((int)$storm["Expiry"]["\$date"]["\$numberLong"], 1000);
		if ($now >= $start && $now < $end) {
			$response["fissures"]++;
		}
	}
}

echo json_encode($response);
