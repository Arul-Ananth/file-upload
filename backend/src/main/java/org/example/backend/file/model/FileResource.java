package org.example.backend.file.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "files")
@Getter
@Setter
@NoArgsConstructor
public class FileResource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String originalFilename;

    @Column(nullable = false)
    private String contentType;

    @Column(nullable = false)
    private long size;

    @Column(length = 128, nullable = false)
    private String checksum; // SHA-256

    @Column(nullable = false, unique = true)
    private String storageFilename; // UUID-based name on disk

    @Column(nullable = false)
    private OffsetDateTime uploadTime = OffsetDateTime.now();

    @Column(nullable = false)
    private long downloadCount = 0L;
}
