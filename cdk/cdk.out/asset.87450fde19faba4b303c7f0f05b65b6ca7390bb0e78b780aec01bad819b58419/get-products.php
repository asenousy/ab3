<?php
    try {
      // header("Content-Type:application/json");

      $secrets = getenv("SECRETS");
      $configs1 = json_encode($secrets);
      $configs2 = json_decode($secrets);
      $servername1 = $configs1['DB_HOST'];
      $servername2 = $configs2['DB_HOST'];
      $servername3 = $secrets['DB_HOST'];
      echo $servername1;
      echo $servername2;
      echo $servername3;
      // $username = $configs["DB_USER"];
      // $password = $configs["DB_PW"];
      // $dbName = $configs["DB_NAME"];

      // $conn = new PDO("mysql:host=$servername;dbname=$dbName", $username, $password);
      // $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
      
      // $stmt = $conn->prepare("SELECT * FROM products");
      // $stmt->execute();
      // $stmt->setFetchMode(PDO::FETCH_ASSOC);
      // $result = $stmt->fetchAll();
      
      // $json_response = json_encode($result);
      // echo $json_response;
      
    } catch(PDOException $e) {
      echo "Connection failed: " . $e->getMessage();
    }
    
?>