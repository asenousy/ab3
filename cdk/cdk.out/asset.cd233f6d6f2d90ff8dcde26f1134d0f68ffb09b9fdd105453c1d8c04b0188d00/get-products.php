<?php
      $secrets = getenv("SECRETS");
      echo $secrets;
    // try {
    //   header("Content-Type:application/json");
    //   $servername = getenv("DB_HOST");
    //   $username = getenv("DB_USER");
    //   $password = getenv("DB_PW");
    //   $dbName = getenv("DB_NAME");

    //   $conn = new PDO("mysql:host=$servername;dbname=$dbName", $username, $password);
    //   $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
      
    //   $stmt = $conn->prepare("SELECT * FROM products");
    //   $stmt->execute();
    //   $stmt->setFetchMode(PDO::FETCH_ASSOC);
    //   $result = $stmt->fetchAll();
      
    //   $json_response = json_encode($result);
    //   echo $json_response;
      
    // } catch(PDOException $e) {
    //   echo "something failed: ";
    //   echo "Connection failed: " . $e->getMessage();
    // }
    
?>