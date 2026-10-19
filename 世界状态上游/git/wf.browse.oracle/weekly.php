<?php
//header("Cache-Control: public, max-age=0");
header("Content-Type: application/json");

function readJsonFile($filename)
{
	$content = file_get_contents($filename);
	while ($content === false || ($json = json_decode($content, true)) === null)
	{
		$content = file_get_contents($filename);
	}
	return $json;
}

$worldState = readJsonFile("worldState.json");
$missionTypes = json_decode(file_get_contents("data/ExportMissionTypes.json"), true);

function simplify_conquest($conquest, &$missions, &$frameVariables)
{
	global $missionTypes;
	foreach ($conquest["Missions"] as $mission)
	{
		$missionTypeDisplayName = substr($missionTypes[$mission["missionType"]]["name"], 37);
		if ($missionTypeDisplayName == "Defense" && $conquest["Type"] == "CT_LAB")
		{
			$missionTypeDisplayName = "DualDefense";
		}
		$conditions = [];
		foreach ($mission["difficulties"][1]["risks"] as $risk)
		{
			if ($risk == "EMPBlackHole")
			{
				array_push($conditions, "MagneticHounds");
			}
			else
			{
				array_push($conditions, $risk);
			}
		}
		array_push($missions, [
			"type" => $missionTypeDisplayName,
			"variant" => $mission["difficulties"][1]["deviation"],
			"conditions" => $conditions,
		]);
	}
	foreach ($conquest["Variables"] as $fv)
	{
		if ($fv == "DullBlades")
		{
			array_push($frameVariables, "ComboCountChance");
		}
		else if ($fv == "Undersupplied")
		{
			array_push($frameVariables, "MaxAmmo");
		}
		else
		{
			array_push($frameVariables, $fv);
		}
	}
}

$labConquestMissions = [];
$labConquestFrameVariables = [];
$hexConquestMissions = [];
$hexConquestFrameVariables = [];

$now = time();
$expiry = $now + 2;
foreach ($worldState["Conquests"] as $conquest)
{
	$start = intdiv((int)$conquest["Activation"]["\$date"]["\$numberLong"], 1000);
	$end = intdiv((int)$conquest["Expiry"]["\$date"]["\$numberLong"], 1000);
	if ($now >= $start && $now < $end)
	{
		$expiry = $end;
		if ($conquest["Type"] == "CT_LAB")
		{
			simplify_conquest($conquest, $labConquestMissions, $labConquestFrameVariables);
		}
		else if ($conquest["Type"] == "CT_HEX")
		{
			simplify_conquest($conquest, $hexConquestMissions, $hexConquestFrameVariables);
		}
	}
}

//$expiry = (round(($now - 1391990400) / 604800) + 1) * 604800 + 1391990400;
header("Cache-Control: public, max-age=".(($expiry - 1) - $now));
echo json_encode([
	"expiry" => $expiry,
	"labConquestMissions" => $labConquestMissions,
	"labConquestFrameVariables" => $labConquestFrameVariables,
	"hexConquestMissions" => $hexConquestMissions,
	"hexConquestFrameVariables" => $hexConquestFrameVariables,
]);

