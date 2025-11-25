package org.example.backend.file.repo;

import org.example.backend.file.model.FileResource;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FileResourceRepository extends JpaRepository<FileResource, Long> {
    Optional<FileResource> findByStorageFilename(String storageFilename);
}
